import express from 'express';
const router = express.Router();
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './auth.js';

// list chats (rooms)
router.get('/rooms', async (req, res) => {
  // Use aggregation to join with messages and count them
  const rooms = await Chat.aggregate([
    { $sort: { createdAt: -1 } },
    { $limit: 50 },
    {
      $lookup: {
        from: 'messages', // the name of the messages collection
        localField: '_id',
        foreignField: 'chatId',
        as: 'messages'
      }
    },
    {
      $project: {
        title: 1,
        createdAt: 1,
        messageCount: { $size: '$messages' }
      }
    }
  ]);
  res.json(rooms); // Note: this now returns an array of rooms with messageCount
});

// create room
router.post('/rooms', authMiddleware, async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ message: 'Missing title' });
  const c = new Chat({ title, authorId: req.user.id });
  await c.save();
  res.json(c);
});

// fetch messages for room (threaded)
router.get('/rooms/:id/messages', async (req, res) => {
  const { id } = req.params;
  // Use lean() for performance and select() to shape the output
  const messages = await Message.find({ chatId: id })
    .sort({ createdAt: 1 })
    .limit(100)
    .select({
      content: 1,
      _id: 1,
      createdAt: 1,
      avatar: 1,
      userId: '$authorId' // Project authorId as userId
    })
    .lean();
  res.json(messages);
});

export default router;