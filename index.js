import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("server ok");
});

app.listen(3000, () => {
  console.log("server running");
});
