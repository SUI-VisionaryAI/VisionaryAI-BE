const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const AIModel = require("../models/AIModel");

const router = express.Router();
const upload = multer({ dest: "temp/" });

const TEMP_DIR = path.join(__dirname, "..", "chunks");
const FINAL_DIR = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(FINAL_DIR)) fs.mkdirSync(FINAL_DIR);

// ✅ CHUNK - Upload single chunk
router.post("/upload/chunk", upload.single("chunk"), (req, res) => {
  const { uploadId, chunkIndex } = req.body;
  const chunkDir = path.join(TEMP_DIR, uploadId);

  if (!fs.existsSync(chunkDir)) {
    return res.status(400).json({ error: "Upload session not found" });
  }

  const chunkPath = path.join(chunkDir, chunkIndex);
  fs.renameSync(req.file.path, chunkPath);

  res.sendStatus(200);
});

router.post("/models/finalize", async (req, res) => {
  const { uploadId } = req.body;
  const uploadDir = path.join(TEMP_DIR, uploadId);

  if (!fs.existsSync(uploadDir)) {
    return res.status(400).json({ error: "Upload session not found" });
  }

  const metaPath = path.join(uploadDir, `${uploadId}-meta.json`);
  const meta = JSON.parse(fs.readFileSync(metaPath));
  const model = await AIModel.findById(meta.modelId);

  if (!model) {
    return res.status(404).json({ error: "Model not found" });
  }

  // 🔥 Get original extension from meta.fileName
  console.log(meta);
  const originalExt = meta.fileName?.split(".").pop() || "bin";
  const versionSafe = meta.versionNumber.replace(/\s+/g, "_");
  const fileName = `${model._id}_v${versionSafe}.${originalExt}`;
  //   console.log(fileName)
  const finalPath = path.join(FINAL_DIR, fileName);

  const writeStream = fs.createWriteStream(finalPath);

  const chunkFiles = fs
    .readdirSync(uploadDir)
    .filter((f) => f !== "meta.json")
    .sort((a, b) => parseInt(a) - parseInt(b));

  for (const chunkFile of chunkFiles) {
    const chunkData = fs.readFileSync(path.join(uploadDir, chunkFile));
    writeStream.write(chunkData);
  }

  writeStream.end();

  writeStream.on("finish", async () => {
    model.versions.push({
      versionNumber: meta.versionNumber,
      description: meta.description,
      filePath: `/uploads/${fileName}`,
    });

    await model.save();
    fs.rmSync(uploadDir, { recursive: true });

    res.json({
      success: true,
      modelId: model._id,
      filePath: `/uploads/${fileName}`,
    });
  });
});

module.exports = router;
