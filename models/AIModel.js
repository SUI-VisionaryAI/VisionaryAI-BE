const mongoose = require("mongoose");

const versionSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId },
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
  blockchainId: { type: String, default: "" },
  price: { type: String, default: 0 },
  image: { type: String, default: "" },
  shortDescription: { type: String, default: "" },
  longDescription: { type: String, default: "" },
  allowCommercialUse: { type: Boolean, default: false },
  allowResale: { type: Boolean, default: false },
});

module.exports = mongoose.model("AIModel", aiModelSchema);