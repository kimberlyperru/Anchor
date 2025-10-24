const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const User = require('../models/User');

// limit signup attempts
const signupLimiter = rateLimit({ windowMs: 60*60*1000, max: 10, message: 'Too many signups' });

const { processTextForModeration } = require('../utils/moderation');

// signup: note your product spec said free users pay Ksh50 sign-up fee and premium Ksh300/month.
// For demo, we accept signup and return price to pay; payment endpoints live in /api/payments
router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const { email, password, avatar } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Missing email/password' });

    // basic moderation check on email? (skip)
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email exists' });

    const hash = await bcrypt.hash(password, 10);
    const user = new User({ email, passwordHash: hash, avatar: avatar || 'fox' });
    await user.save();

    // Note: sign-up fee payment should be collected before activation in a real flow.
    const token = jwt.sign({ id: user._id, avatar: user.avatar }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ message: 'User created (pending pay)', user: { id: user._id, avatar: user.avatar }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid creds' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ message: 'Invalid creds' });

    const token = jwt.sign({ id: user._id, avatar: user.avatar }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, avatar: user.avatar, isPremium: user.isPremium, premiumUntil: user.premiumUntil } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// middleware to protect routes
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'No token' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

router.get('/me', authMiddleware, async (req, res) => {
  const User = require('../models/User');
  const u = await User.findById(req.user.id).select('-passwordHash');
  res.json(u);
});

module.exports = router;
