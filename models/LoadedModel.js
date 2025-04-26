const mongoose = require("mongoose");

const loadedModelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  modelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AIModel",
    required: true,
  },
  versionID: { type: String, required: true },
  loadedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["loading", "loaded", "error"],
    default: "loading",
  },
});

module.exports = mongoose.model("LoadedModel", loadedModelSchema);
