import express from "express";
import multer from "multer";

const MAX_COUNT = 5;
const FILE_MAX_MB = 10;
const TOTAL_MAX_MB = 20;

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_MAX_MB * 1024 * 1024, files: MAX_COUNT },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(
        new Error("PDF, JPG, PNG, WEBP 형식의 파일만 업로드할 수 있어요."),
      );
    }

    cb(null, true);
  },
});

function multerErrorHandler(err, req, res, next) {
  if (!err) return next();

  // multer가 던지는 에러 코드들
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

  return res.status(400).json({ message: err.message ?? "업로드 실패" });
}

// 주의: “PDF/이미지 → OpenAI”에서 현실 체크 2가지
// PDF는 그대로 보내기보다 보통:
// 텍스트 추출(또는 OpenAI의 파일/비전 기능) 흐름을 탑니다.
// 이미지는 비전 모델로 보내야 하고,
// 파일 크기/해상도 제한이 있을 수 있어요(그래서 서버 제한이 중요)

app.post("/api/analyze", upload.array("files", MAX_COUNT), (req, res) => {
  const totalBytes = (req.files ?? []).reduce(
    (sum, f) => sum + (f.size ?? 0),
    0,
  );
  const totalMB = totalBytes / 1024 / 1024;

  // ✅ 총합 초과
  if (totalMB > TOTAL_MAX_MB) {
    return res.status(413).json({
      message: `전체 업로드 용량은 ${TOTAL_MAX_MB}MB를 넘을 수 없어요.`,
    });
  }

  // 여기서 req.files[i].buffer 사용 가능
  // 예: PDF 분석 / OCR / 이미지 처리

  return (
    res.json({
      ok: true,
      count: req.files.length,
      totalMB,
    }),
    multerErrorHandler
  );
});

app.listen(3000, () => {
  console.log("server running");
});
