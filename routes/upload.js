const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const AIModel = require("../models/AIModel");
const unzipper = require("unzipper");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

const router = express.Router();
const upload = multer({ dest: "temp/" });

const TEMP_DIR = path.join(__dirname, "..", "chunks");
const FINAL_DIR = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(FINAL_DIR)) fs.mkdirSync(FINAL_DIR);

router.post("/upload/init-upload", (req, res) => {
  const { uploadId } = req.body;

  if (!uploadId) {
    return res.status(400).json({ error: "uploadId is required" });
  }

  const uploadPath = path.join(__dirname, "..", "chunks", uploadId);

  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  res.json({ success: true });
});

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

  const originalExt = meta.fileName?.split(".").pop() || "bin";
  const versionSafe = new mongoose.Types.ObjectId().toString();

  // const versionSafe = meta.versionNumber.replace(/\s+/g, "_");
  const fileName = `${model._id}_v${versionSafe}.${originalExt}`;
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
    writeStream.close();

    setTimeout(async () => {
      const version = {
        description: meta.description,
        filePath: `/uploads/${fileName}`,
        _id: versionSafe,
        versionNumber: meta.versionNumber,
        longDescription: meta.longDescription,
      };

      model.versions.push(version);
      await model.save();

      const savedVersion = model.versions[model.versions.length - 1]; // Get the newly added version
      fs.rmSync(uploadDir, { recursive: true });

      res.json({
        success: true,
        modelId: model._id,
        versionID: savedVersion._id, // Return versionID instead of versionNumber
        filePath: `/uploads/${fileName}`,
      });

      if (originalExt === "zip") {
        const extractFolderName = `${model._id}_${savedVersion._id}.zip`;
        const extractPath = path.join(
          __dirname,
          "..",
          "AImodels",
          extractFolderName
        );

        try {
          fs.mkdirSync(extractPath, { recursive: true });
          fs.createReadStream(finalPath)
            .pipe(unzipper.Extract({ path: extractPath }))
            .on("close", () => {
              console.log(`✅ Extracted ${fileName} to ${extractPath}`);
            })
            .on("error", (err) => {
              console.error(`❌ Failed to extract ${fileName}:`, err);
            });
        } catch (err) {
          console.error(`❌ Failed to extract ${fileName}:`, err);
        }
      }
    }, 200);
  });
});

router.post("/upload/finalize", async (req, res) => {
  const { uploadId } = req.body;
  const uploadDir = path.join(__dirname, "..", "chunks", uploadId);

  if (!fs.existsSync(uploadDir)) {
    return res.status(400).json({ error: "Upload session not found" });
  }

  try {
    const chunkFiles = fs
      .readdirSync(uploadDir)
      .filter((f) => !isNaN(f)) // Only numeric chunk files
      .sort((a, b) => parseInt(a) - parseInt(b));

    if (chunkFiles.length === 0) {
      return res.status(400).json({ error: "No chunks found for upload." });
    }

    const fileId = new mongoose.Types.ObjectId().toString(); // Random fileId
    const fileName = `${fileId}.zip`; // Assume file is zip (or you can make it flexible)
    const finalPath = path.join(__dirname, "..", "uploads", fileName);

    const writeStream = fs.createWriteStream(finalPath);

    for (const chunkFile of chunkFiles) {
      const chunkData = fs.readFileSync(path.join(uploadDir, chunkFile));
      writeStream.write(chunkData);
    }

    writeStream.end();

    writeStream.on("finish", async () => {
      writeStream.close();
      fs.rmSync(uploadDir, { recursive: true });

      res.json({
        success: true,
        fileId,
        fileName,
        filePath: `/uploads/${fileName}`,
      });
    });
  } catch (err) {
    console.error("Failed to finalize upload:", err);
    res.status(500).json({ error: "Failed to finalize upload" });
  }
});

router.get(
  "/models/:modelId/versions/:versionID/files/:fileName/download",
  async (req, res) => {
    const { modelId, versionID, fileName } = req.params;

    if ([modelId, versionID, fileName].some((p) => p.includes(".."))) {
      return res.status(400).json({ error: "Invalid path." });
    }

    try {
      const model = await AIModel.findById(modelId);
      if (!model) {
        return res.status(404).json({ error: "Model not found" });
      }

      const versionEntry = model.versions.id(versionID); // Use Mongoose's subdocument lookup
      if (!versionEntry) {
        return res
          .status(404)
          .json({ error: `Version with ID ${versionID} not found` });
      }

      const folderName = `${modelId}_${versionID}.zip`;
      const modelFolder = path.join(__dirname, "..", "AImodels", folderName);
      const directPath = path.join(modelFolder, fileName);

      if (fs.existsSync(directPath)) {
        return res.download(directPath, fileName);
      }

      const contents = fs.readdirSync(modelFolder, { withFileTypes: true });
      const subfolders = contents.filter((dirent) => dirent.isDirectory());

      if (subfolders.length === 1) {
        const nestedPath = path.join(modelFolder, subfolders[0].name, fileName);
        if (fs.existsSync(nestedPath)) {
          return res.download(nestedPath, fileName);
        }
      }

      return res.status(404).json({ error: "File not found." });
    } catch (err) {
      console.error("Download error:", err);
      res.status(500).json({ error: "Server error during download." });
    }
  }
);

module.exports = router;
