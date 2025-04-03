const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const AIModel = require("../models/AIModel");

const router = express.Router();

const TEMP_DIR = path.join(__dirname, "..", "chunks");
const FINAL_DIR = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);
if (!fs.existsSync(FINAL_DIR)) fs.mkdirSync(FINAL_DIR);

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
  } = req.body;

  const model = new AIModel({
    modelName,
    modelType,
    category,
    functionType,
    tags,
    status: "unreleased",
    versions: [],
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
      fileName
    })
  );

  res.json({ modelId: model._id, uploadId });
});

module.exports = router;
