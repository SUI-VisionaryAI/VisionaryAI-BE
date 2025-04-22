const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const AIModel = require("../models/AIModel");
const unzipper = require("unzipper");

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

  const originalExt = meta.fileName?.split(".").pop() || "bin";
  const versionSafe = meta.versionNumber.replace(/\s+/g, "_");
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

      if (originalExt === "zip") {
        const extractFolderName = `${model._id}_v${versionSafe}.${originalExt}`;
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
          console.log(`✅ Extracted ${fileName} to ${extractPath}`);
        } catch (err) {
          console.error(`❌ Failed to extract ${fileName}:`, err);
        }
      }
    }, 200);
  });
});

router.get("/models/:id/download-file", async (req, res) => {
  try {
    const { id } = req.params;
    const { version } = req.query;

    const model = await AIModel.findById(id);
    if (!model) return res.status(404).json({ error: "Model not found" });

    let versionEntry;

    if (version) {
      versionEntry = model.versions.find((v) => v.versionNumber === version);
      if (!versionEntry) {
        return res.status(404).json({ error: `Version ${version} not found` });
      }
    } else {
      versionEntry = model.versions[model.versions.length - 1];
    }

    if (!versionEntry) {
      return res.status(400).json({ error: "No version available" });
    }

    const fileName = path.basename(versionEntry.filePath);
    const filePath = path.join(__dirname, "..", "uploads", fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.download(filePath, fileName);
  } catch (err) {
    console.error("Failed to download model file:", err);
    res.status(500).json({ error: "Failed to download model file" });
  }
});

router.get(
  "/models/:modelId/versions/:version/files/:fileName/download",
  async (req, res) => {
    const { modelId, version, fileName } = req.params;

    if ([modelId, version, fileName].some((p) => p.includes(".."))) {
      return res.status(400).json({ error: "Invalid path." });
    }

    try {
      const model = await AIModel.findById(modelId);
      if (!model) {
        return res.status(404).json({ error: "Model not found" });
      }

      const versionSafe = version.replace(/\s+/g, "_");
      const folderName = `${modelId}_v${versionSafe}.zip`;
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
