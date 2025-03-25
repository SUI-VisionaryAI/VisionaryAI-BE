const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyPersonalMessage } = require('@mysten/sui.js/verify');

const CHALLENGE_PREFIX = 'Authenticate with Walrus - ';

router.post('/auth', async (req, res) => {
  const { walletAddress, message, signature } = req.body;

  if (!walletAddress || !message || !signature) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }

  try {
    const isValid = verifyPersonalMessage(message, signature, walletAddress);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature.' });
    }

    let user = await User.findOne({ walletAddress });

    if (!user) {
      user = await User.create({ walletAddress });
    }

    return res.json({
      success: true,
      message: 'Authenticated successfully.',
      user,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
