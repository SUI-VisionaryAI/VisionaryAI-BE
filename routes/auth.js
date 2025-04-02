const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyPersonalMessage, publicKeyToAddress } = require('@mysten/sui.js/verify');
const { fromB64 } = require('@mysten/sui.js/utils');

const CHALLENGE_PREFIX = 'Authenticate with Walrus - ';
const base64Regex = /^[A-Za-z0-9+/=]+$/;


router.post('/auth', async (req, res) => {
  const { walletAddress, message, signature } = req.body;
  console.log(walletAddress, message, signature);
  
  if (!walletAddress || !message || !signature) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }

  try {
    const messageBytes = new TextEncoder().encode(message);
    // const signatureBytes = fromB64(signature);
    // console.log(base64Regex.test(signatureBytes))
    // const publicKey = await verifyPersonalMessage(messageBytes, signatureBytes);
    // if (!publicKey) {
    //   return res.status(401).json({ error: 'Invalid signature.' });
    // }

    // const derivedAddress = publicKeyToAddress(publicKey);

    // if (derivedAddress !== walletAddress) {
    //   return res.status(401).json({ error: 'Wallet address does not match signature.' });
    // }

    // Create or find the user
    let user = await User.findOne({ walletAddress });
    if (!user) {
      user = await User.create({ walletAddress });
    }

    return res.json({
      success: true,
      message: 'Authenticated successfully.',
      user: {
        walletAddress: user?.walletAddress,
        createdAt: user?.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router
