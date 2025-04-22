const mongoose = require("mongoose");

const loadedModelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  modelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AIModel",
    required: true,
  },
  versionID: { type: String, required: true }, // Track the specific version
  loadedAt: { type: Date, default: Date.now }, // Timestamp for when the model was loaded
});

module.exports = mongoose.model("LoadedModel", loadedModelSchema);
