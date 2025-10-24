const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Endpoint to "initiate" mpesa payment for signup or premium (mock)
router.post('/mpesa/init', async (req, res) => {
  const { amount, email, purpose } = req.body;
  // In a real integration you'd call M-Pesa API (STK Push) here.
  // For demo we simulate success response with a paymentId.
  const paymentId = 'MPESA-' + Date.now();
  // store payment record in DB if desired
  res.json({ ok: true, paymentId, message: `Simulated M-Pesa push for Ksh ${amount} to ${email} for ${purpose}` });
});

// webhook callback from M-Pesa (simulated)
router.post('/mpesa/callback', async (req, res) => {
  const { paymentId, status, userId, amount, purpose } = req.body;
  // find user and apply subscription if premium or record sign-up fee
  if (status === 'success') {
    const u = await User.findById(userId);
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (purpose === 'signup-free') {
      // give access (you specified free users pay Ksh50)
      // maybe mark that signup fee was received; for demo do nothing
    }
    if (purpose === 'premium') {
      const now = new Date();
      const until = new Date(now.setMonth(now.getMonth() + 1));
      u.isPremium = true;
      u.premiumUntil = until;
      await u.save();
    }
  }
  res.json({ ok: true });
});

// PayPal mock: create order
router.post('/paypal/create-order', (req, res) => {
  const { amount, purpose } = req.body;
  // In production use PayPal SDK to create an order and return approval link
  const orderId = 'PAYPAL-' + Date.now();
  res.json({ ok: true, orderId, approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`, message: 'Simulated approval url' });
});

// capture order (mock)
router.post('/paypal/capture', async (req, res) => {
  const { orderId, userId, purpose } = req.body;
  // simulate success and set user premium
  if (purpose === 'premium') {
    const u = await User.findById(userId);
    const now = new Date();
    const until = new Date(now.setMonth(now.getMonth() + 1));
    u.isPremium = true;
    u.premiumUntil = until;
    await u.save();
    return res.json({ ok: true });
  }
  res.json({ ok: true });
});

module.exports = router;
