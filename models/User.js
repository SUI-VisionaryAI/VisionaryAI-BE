const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    unique: true,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Add any additional fields like username, bio, etc.
});

module.exports = mongoose.model('User', userSchema);
