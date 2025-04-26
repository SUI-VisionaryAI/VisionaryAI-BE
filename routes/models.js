const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const AIModel = require("../models/AIModel");
const LoadedModel = require("../models/LoadedModel");
const User = require("../models/User");
const axios = require("axios");
require("dotenv").config();

const MAX_MODEL_LOAD_QUEUE =
  parseInt(process.env.MAX_MODEL_LOAD_QUEUE, 10) || 5;
console.log("MAX_MODEL_LOAD_QUEUE", MAX_MODEL_LOAD_QUEUE);
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
    price,
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

router.get("/models/loaded", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const loadedModels = await LoadedModel.find({ userId })
      .populate("modelId")
      .select("modelId versionNumber loadedAt");

    res.json({ success: true, loadedModels });
  } catch (err) {
    console.error("Failed to fetch loaded models:", err);
    res.status(500).json({ error: "Failed to fetch loaded models" });
  }
});
router.get("/models/:modelId/versions/:version/files", async (req, res) => {
  const { modelId, version } = req.params;

  // Sanity check to prevent path traversal
  if ([modelId, version].some((p) => p.includes(".."))) {
    return res.status(400).json({ error: "Invalid path" });
  }

  try {
    const versionSafe = version.replace(/\s+/g, "_");

    // Find the model
    const model = await AIModel.findById(modelId);
    if (!model) {
      return res.status(404).json({ error: "Model not found" });
    }

    // Construct base extracted folder path
    const baseFolder = path.join(
      __dirname,
      "..",
      "AImodels",
      `${modelId}_${versionSafe}.zip`
    );

    // If extracted folder contains a nested directory, go into it
    let folderPath = baseFolder;
    const entries = fs.readdirSync(baseFolder, { withFileTypes: true });
    const subdirs = entries.filter((e) => e.isDirectory());
    if (subdirs.length === 1) {
      folderPath = path.join(baseFolder, subdirs[0].name);
    }

    const files = fs
      .readdirSync(folderPath)
      .filter((f) => fs.statSync(path.join(folderPath, f)).isFile())
      .map((fileName) => {
        const fullPath = path.join(folderPath, fileName);
        const stat = fs.statSync(fullPath);
        return {
          fileName,
          size: stat.size,
          createdAt: stat.birthtime,
        };
      });

    res.json({ folder: path.basename(folderPath), files });
  } catch (err) {
    console.error("Error listing version files:", err);
    res.status(500).json({ error: "Failed to list version files" });
  }
});

/* ************************
      LOADING MODELS
************************ */

router.post("/models/:id/load", async (req, res) => {
  try {
    const { id } = req.params;
    const { userAddress, versionID } = req.body;

    if (!userAddress) {
      return res.status(400).json({ error: "User address is required" });
    }

    if (!versionID) {
      return res.status(400).json({ error: "Version ID is required" });
    }

    const model = await AIModel.findById(id);
    if (!model) {
      return res.status(404).json({ error: "Model not found" });
    }

    // Check if the version exists in the model
    const versionExists = model.versions.some(
      (v) => v._id.toString() === versionID
    );
    if (!versionExists) {
      return res
        .status(404)
        .json({ error: `Version with ID ${versionID} not found` });
    }
    // check is user exists in the database
    const user = await User.findOne({ walletAddress: userAddress });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Count the number of models currently loaded by the user
    const loadedCount = await LoadedModel.countDocuments({ userAddress });
    console.log("Loaded count:", loadedCount);
    
    if (loadedCount >= MAX_MODEL_LOAD_QUEUE) {
      return res.status(400).json({
        error: `Maximum number of loaded models (${MAX_MODEL_LOAD_QUEUE}) reached`,
      });
    }

    // Check if the specific version of the model is already loaded by the user
    const alreadyLoaded = await LoadedModel.findOne({
      userId: user._id,
      modelId: id,
      versionID,
    });
    if (alreadyLoaded) {
      return res.status(400).json({ error: "Model version is already loaded" });
    }
    
    // const loadedModel = new LoadedModel({
    //   userId: user._id,
    //   modelId: id,
    //   versionID,
    //   loadedAt: new Date(),
    // });
    // await loadedModel.save();

    // res.json({
    //   success: true,
    //   message: `Model ${model.modelName} (version ID ${versionID}) loaded successfully`,
    // });
    const GPU_ENDPOINT = process.env.GPU_ENDPOINT;
    console.log("GPU_ENDPOINT", GPU_ENDPOINT);
    if (!GPU_ENDPOINT) {
      return res.status(500).json({ error: "GPU endpoint is not configured" });
    }

    try {
      const response = await axios.post(`${GPU_ENDPOINT}/load-model`, {
        modelId: id,
        versionId: versionID,
      });

      // if (response.data.success) {
      //   // Add the model version to the loaded models collection
      //   const loadedModel = new LoadedModel({
      //     userId: user._id,
      //     modelId: id,
      //     versionID,
      //     loadedAt: new Date(),
      //   });
      //   await loadedModel.save();

      //   res.json({
      //     success: true,
      //     message: `Model ${model.modelName} (version ID ${versionID}) loaded successfully`,
      //   });
      // } else {
      //   res.status(500).json({ error: "Failed to load model on GPU" });
      // }
    } catch (err) {
      console.error("Error calling GPU endpoint:", err);
      res.status(500).json({ error: "Failed to load model on GPU" });
    }
  } catch (err) {
    console.error("Failed to load model:", err);
    res.status(500).json({ error: "Failed to load model" });
  }
});

module.exports = router;
