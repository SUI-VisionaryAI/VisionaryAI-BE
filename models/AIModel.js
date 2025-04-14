const mongoose = require("mongoose");

const versionSchema = new mongoose.Schema({
  versionNumber: { type: String, required: true },
  description: { type: String, default: "" },
  filePath: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  longDescription: { type: String, default: "" },
});

const aiModelSchema = new mongoose.Schema({
  modelName: { type: String, required: true },
  modelType: { type: String },
  owner: { type: String },
  category: { type: String },
  functionType: { type: String },
  tags: [{ type: String }],
  status: {
    type: String,
    enum: ["unreleased", "released"],
    default: "unreleased",
  },
  versions: [versionSchema],
  downloadCount: { type: Number, default: 0 },
  likedUsers: [{ type: String }],
  runCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AIModel", aiModelSchema);
