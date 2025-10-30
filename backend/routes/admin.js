import express from 'express';
import { authMiddleware, adminMiddleware } from './auth.js';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';

const router = express.Router();

// All routes in this file are protected and require admin privileges
router.use(authMiddleware, adminMiddleware);

// ---------------------------------
// User Management
// ---------------------------------

// GET /api/admin/users - List all users
router.get('/users', async (req, res) => { // Now with pagination, filtering, and sorting
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = req.query.filter || '';
    const sortKey = req.query.sortKey || 'createdAt';
    const sortDirection = req.query.sortDirection === 'ascending' ? 1 : -1;

    const query = {};
    if (filter) {
      // Case-insensitive search on the email field
      query.email = { $regex: filter, $options: 'i' };
    }

    const totalUsers = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ [sortKey]: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      users,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error });
  }
});

// DELETE /api/admin/users/:id - Delete a user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error });
  }
});

// POST /api/admin/users/:id/ban - Ban or unban a user
router.post('/users/:id/ban', async (req, res) => {
  try {
    const { id } = req.params;
    const { ban } = req.body; // Expecting { ban: true } or { ban: false }

    const user = await User.findByIdAndUpdate(id, { isBanned: ban }, { new: true }).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error updating user ban status', error });
  }
});

// PUT /api/admin/users/:id - Update user details
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isPremium, premiumUntil, isAdmin } = req.body;

    // Build an update object with only the fields provided in the request
    const updates = {};
    if (typeof isPremium === 'boolean') updates.isPremium = isPremium;
    if (premiumUntil !== undefined) {
      // Allow setting premiumUntil to null or a valid date
      updates.premiumUntil = premiumUntil ? new Date(premiumUntil) : null;
    }
    if (typeof isAdmin === 'boolean') {
      // Prevent an admin from removing their own admin status if they are the last one
      if (req.user.id === id && !isAdmin) {
        const adminCount = await User.countDocuments({ isAdmin: true });
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Cannot remove the last administrator.' });
        }
      }
      updates.isAdmin = isAdmin;
    }

    const updatedUser = await User.findByIdAndUpdate(id, { $set: updates }, { new: true }).select('-passwordHash');
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Error updating user details', error });
  }
});

// ---------------------------------
// Chat Room Management
// ---------------------------------

// DELETE /api/admin/rooms/:id - Delete a chat room and all its messages
router.delete('/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Promise.all([Chat.findByIdAndDelete(id), Message.deleteMany({ chatId: id })]);
    res.json({ message: 'Room and messages deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting room', error });
  }
});

export default router;