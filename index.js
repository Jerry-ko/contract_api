import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";

const MAX_COUNT = 5;
const FILE_MAX_MB = 10;
const TOTAL_MAX_MB = 20;

const app = express();
// 메모리 저장소 사용: 파일 타입 및 파일당 크기와 총합 용량 체크, 서버 재시작 시 데이터 사라짐
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_MAX_MB * 1024 * 1024, files: MAX_COUNT },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("JPG, PNG, WEBP 형식의 파일만 업로드할 수 있어요."));
    }

    cb(null, true);
  },
});

// IP당 1분에 3회로 제한 (파일 업로드는 리소스 많이 쓰니까 엄격하게)
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 3, // 1분 3회
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    return res.status(429).json({
      ok: false,
      code: "RATE_LIMITED",
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    });
  },
});

// 주의: “PDF/이미지 → OpenAI”에서 현실 체크 2가지
// PDF는 그대로 보내기보다 보통:
// 텍스트 추출(또는 OpenAI의 파일/비전 기능) 흐름을 탑니다.
// 이미지는 비전 모델로 보내야 하고,
// 파일 크기/해상도 제한이 있을 수 있어요(그래서 서버 제한이 중요)

app.post("/api/analyze", analyzeLimiter, (req, res) => {
  upload.array("files", MAX_COUNT)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // multer limits 에러
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(413)
          .json({ message: `파일 1개 최대 ${FILE_MAX_MB}MB까지 가능해요.` });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res
          .status(413)
          .json({ message: `파일은 최대 ${MAX_COUNT}개까지 가능해요.` });
      }
    }
    // multer filefilter 에러
    if (err) {
      return res.status(400).json({ message: err.message ?? "업로드 실패" });
    }

    // 여기서부터는 multer가 성공적으로 끝난 상태
    const files = req.files ?? [];
    const totalBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
    const totalMB = totalBytes / 1024 / 1024;

    // ✅ 총합 초과
    if (totalMB > TOTAL_MAX_MB) {
      return res.status(413).json({
        message: `전체 업로드 용량은 ${TOTAL_MAX_MB}MB를 넘을 수 없어요.`,
      });
    }

    return res.status(200).json({ ok: true, count: req.files.length, totalMB });
  });
});

app.listen(3000, () => {
  console.log("server running");
});
