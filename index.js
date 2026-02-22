import express from "express";
import multer from "multer";

const app = express();
const upload = multer({ dest: "uploads/" });

app.post("/api/analyze", upload.single("file"), (req, res) => {
  console.log("파일 옴?", !!req.file);
  console.log(req.file);
  res.json({ ok: true });
});

app.listen(3000, () => {
  console.log("server running");
});
