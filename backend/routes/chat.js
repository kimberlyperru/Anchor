const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');

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
router.post('/rooms', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ message: 'Missing title' });
  const c = new Chat({ title });
  await c.save();
  res.json(c);
});

// fetch messages for room (threaded)
router.get('/rooms/:id/messages', async (req, res) => {
  const { id } = req.params;
  const messages = await Message.find({ chatId: id }).sort({ createdAt: 1 }).limit(100);
  res.json(messages);
});

module.exports = router;
