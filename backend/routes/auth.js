import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import User from '../models/User.js';

const router = Router();

// Rate limiters
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many signup attempts from this IP, please try again after an hour' });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts from this IP, please try again after 15 minutes' });

// signup: note your product spec said free users pay Ksh50 sign-up fee and premium Ksh300/month.
// For demo, we accept signup and return price to pay; payment endpoints live in /api/payments
router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const { email, password, avatar, isPremium } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Missing email/password' });

    // basic moderation check on email? (skip)
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email exists' });

    const hash = await bcrypt.hash(password, 10);
    const user = new User({ email, passwordHash: hash, avatar: avatar || 'fox', isPremium: !!isPremium, isActive: false });
    await user.save();

    // Instead of returning a token, we return payment details.
    // The user will be activated and get a token via the payment callback.
    const amount = isPremium ? 300 : 50; // Premium or free (with signup fee)
    const purpose = isPremium ? 'premium' : 'signup-free';

    res.status(201).json({
      message: 'User created. Proceed to payment.',
      paymentDetails: { userId: user._id, amount, purpose, email: user.email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.isActive) return res.status(403).json({ message: 'Account not active. Please complete payment.' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, avatar: user.avatar, isPremium: user.isPremium, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '30d' });
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
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
}

export {
  router,
  authMiddleware,
  adminMiddleware,
};
