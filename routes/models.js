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
    price
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
    price: price || "0",
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
      longDescription: latestVersion.longDescription,
      price: model.price,
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

router.post("/models/:id/download", async (req, res) => {
  try {
    const { id } = req.params;
    const model = await AIModel.findByIdAndUpdate(
      id,
      { $inc: { downloadCount: 1 } },
      { new: true }
    );
    if (!model) return res.status(404).json({ error: "Model not found" });
    res.json({ success: true, downloadCount: model.downloadCount });
  } catch (err) {
    console.error("Failed to increment download count:", err);
    res.status(500).json({ error: "Failed to increment download count" });
  }
});
router.post("/models/:id/toggle-like", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    console.log(req.body);
    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (!id) return res.status(400).json({ error: "modelId is required" });

    const model = await AIModel.findById(id);
    if (!model) return res.status(404).json({ error: "Model not found" });

    const likedIndex = model.likedUsers.indexOf(userId);
    if (likedIndex === -1) {
      model.likedUsers.push(userId);
    } else {
      model.likedUsers.splice(likedIndex, 1);
    }

    await model.save();
    res.json({ success: true, likedUsers: model.likedUsers });
  } catch (err) {
    console.error("Failed to toggle like:", err);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

router.post("/models/:id/run", async (req, res) => {
  try {
    const { id } = req.params;
    const model = await AIModel.findByIdAndUpdate(
      id,
      { $inc: { runCount: 1 } },
      { new: true }
    );
    if (!model) return res.status(404).json({ error: "Model not found" });
    res.json({ success: true, runCount: model.runCount });
  } catch (err) {
    console.error("Failed to increment run count:", err);
    res.status(500).json({ error: "Failed to increment run count" });
  }
});

router.post("/models/:id/update-blockchain-id", async (req, res) => {
  try {
    const { id } = req.params;
    const { blockchainId } = req.body;

    if (!blockchainId)
      return res.status(400).json({ error: "blockchainId is required" });

    const model = await AIModel.findById(id);
    if (!model) return res.status(404).json({ error: "Model not found" });

    model.blockchainId = blockchainId;
    await model.save();

    res.json({ success: true, blockchainId: model.blockchainId });
  } catch (err) {
    console.error("Failed to update blockchainId:", err);
    res.status(500).json({ error: "Failed to update blockchainId" });
  }
});

module.exports = router;
