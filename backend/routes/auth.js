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

    // Both free and premium users go through a payment flow.
    const amount = isPremium ? 300 : 50; // Premium: 300, Free signup: 50
    const purpose = isPremium ? 'premium' : 'signup-free';

    // ✅ Create a short-lived token for payment authorization
    const paymentToken = jwt.sign({ id: user._id, purpose: 'payment' }, process.env.JWT_SECRET, { expiresIn: '15m' });

    res.status(201).json({
      message: 'User created. Proceed to payment.',
      // ✅ Send the payment token to the frontend
      paymentDetails: { userId: user._id, amount, purpose, email: user.email, token: paymentToken }
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
    let user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.isActive) return res.status(403).json({ message: 'Account not active. Please complete payment.' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    // ✅ Check for premium expiration
    if (user.isPremium && user.premiumUntil && new Date() > new Date(user.premiumUntil)) {
      user.isPremium = false;
      user.premiumUntil = null;
      await user.save();
    }

    user = await User.findById(user._id); // Re-fetch user to get the latest state

    const token = jwt.sign({ id: user._id, avatar: user.avatar, isPremium: user.isPremium, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const userForFrontend = await User.findById(user._id).select('-passwordHash');
    res.json({ token, user: userForFrontend });
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
    let user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ✅ Check for premium expiration on /me, to keep frontend in sync
    if (user.isPremium && user.premiumUntil && new Date() > new Date(user.premiumUntil)) {
      user.isPremium = false;
      user.premiumUntil = null;
      await user.save();
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user status without full auth, used for payment polling
router.get('/me-unactivated/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('isActive isPremium premiumUntil');
    if (!user) return res.status(404).json({ message: 'User not found' });
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
