const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');

// list chats (rooms)
router.get('/rooms', async (req, res) => {
  const rooms = await Chat.find().sort({ createdAt: -1 }).limit(50);
  res.json(rooms);
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
