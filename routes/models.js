const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const AIModel = require("../models/AIModel");

const router = express.Router();

const TEMP_DIR = path.join(__dirname, "..", "chunks");
const FINAL_DIR = path.join(__dirname, "..", "uploads");
const METADATA_DIR = path.join(__dirname, "..", "public", "model-metadata");
if (!fs.existsSync(METADATA_DIR))
  fs.mkdirSync(METADATA_DIR, { recursive: true });

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);
if (!fs.existsSync(FINAL_DIR)) fs.mkdirSync(FINAL_DIR);
router.get("/models", async (req, res) => {
  try {
    const models = await AIModel.find().sort({ createdAt: -1 });
    res.json(models);
  } catch (err) {
    console.error("Failed to fetch AI models:", err);
    res.status(500).json({ error: "Failed to fetch AI models" });
  }
});
router.post("/models/init", async (req, res) => {
  const {
    modelName,
    modelType,
    category,
    functionType,
    tags,
    version,
    description,
    fileName,
    owner,
  } = req.body;

  const model = new AIModel({
    modelName,
    modelType,
    category,
    functionType,
    tags,
    status: "unreleased",
    versions: [],
    owner,
  });

  await model.save();

  const uploadId = uuidv4();
  const uploadPath = path.join(TEMP_DIR, uploadId);
  fs.mkdirSync(uploadPath, { recursive: true });

  fs.writeFileSync(
    path.join(uploadPath, `${uploadId}-meta.json`),
    JSON.stringify({
      modelId: model._id,
      versionNumber: version,
      description: description || "",
      fileName,
    })
  );

  res.json({ modelId: model._id, uploadId });
});
router.post("/models/prepare-metadata", async (req, res) => {
  try {
    const { modelId } = req.body;

    if (!modelId) return res.status(400).json({ error: "modelId is required" });

    const model = await AIModel.findById(modelId);
    if (!model) return res.status(404).json({ error: "Model not found" });

    const latestVersion = model.versions[model.versions.length - 1];
    if (!latestVersion)
      return res.status(400).json({ error: "No version available" });

    const metadata = {
      modelId: model._id,
      modelName: model.modelName,
      description: model.description,
      image: model.image,
      framework: model.framework,
      task: model.task,
      language: model.language,
      license: model.license,
      version: latestVersion.versionNumber,
      versionDescription: latestVersion.description,
    };

    const fileName = `${model._id}_v${metadata.version.replace(
      /\s+/g,
      "_"
    )}.json`;
    const filePath = path.join(METADATA_DIR, fileName);
    const publicUrl = `/model-metadata/${fileName}`;

    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));

    // Update version metadataUrl if not already saved
    latestVersion.metadataUrl = publicUrl;
    await model.save();

    res.json({
      success: true,
      metadataUrl: publicUrl,
    });
  } catch (err) {
    console.error("[prepare-metadata]", err);
    res.status(500).json({ error: "Failed to generate metadata file" });
  }
});

module.exports = router;
