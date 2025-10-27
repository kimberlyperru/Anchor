// ─────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────
import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

// ─────────────────────────────────────────────
// Route Imports
// ─────────────────────────────────────────────
import { router as authRoutes } from './routes/auth.js';
import paymentRoutes from './routes/paymentRoutes.js';
import chatRoutes from './routes/chat.js';
import moderationRoutes from './routes/moderation.js';
import aiRoutes from './routes/ai.js';

// ─────────────────────────────────────────────
// App Setup
// ─────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 4000;

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/mod', moderationRoutes);
app.use('/api/ai', aiRoutes);

// ─────────────────────────────────────────────
// Models
// ─────────────────────────────────────────────
import Chat from './models/Chat.js';
import Message from './models/Message.js';

// ─────────────────────────────────────────────
// Socket.IO Real-Time Chat
// ─────────────────────────────────────────────
import { filterText } from './utils/moderation.js';

io.on('connection', (socket) => {
  console.log(`🟢 Socket connected: ${socket.id}`);

  // Join a chat room (thread)
  socket.on('joinRoom', ({ roomId }) => socket.join(roomId));

  // Leave a room
  socket.on('leaveRoom', ({ roomId }) => socket.leave(roomId));

  // New message event
  socket.on('message', async ({ token, roomId, content, parentId }) => {
    try {
      let userPayload = null;
      if (token) {
        try {
          userPayload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
          console.warn('Invalid token for socket message');
        }
      }

      const cleaned = filterText(content);

      const msg = new Message({
        chatId: roomId,
        authorId: userPayload ? userPayload.id : null,
        avatar: userPayload ? userPayload.avatar : generateAnonAvatar(),
        content: cleaned,
        parentId: parentId || null,
        createdAt: new Date(),
      });

      await msg.save();

      io.to(roomId).emit('message', {
        id: msg._id,
        chatId: roomId,
        userId: msg.authorId,
        avatar: msg.avatar,
        content: msg.content,
        parentId: msg.parentId,
        createdAt: msg.createdAt,
      });
    } catch (err) {
      console.error('❌ Socket message error:', err);
      socket.emit('error', { message: 'Message failed' });
    }
  });

  // Delete message event
  socket.on('deleteMessage', async ({ token, messageId, roomId }) => {
    try {
      if (!token) return;
      const userPayload = jwt.verify(token, process.env.JWT_SECRET);
      const message = await Message.findById(messageId);
      if (!message) return;

      if (message.authorId?.toString() === userPayload.id) {
        await Message.findByIdAndDelete(messageId);
        io.to(roomId).emit('messageDeleted', { messageId });
      }
    } catch (err) {
      console.error('❌ Socket delete error:', err);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Socket disconnected: ${socket.id}`);
  });
});

// ─────────────────────────────────────────────
// Utility: Generate Anonymous Avatar
// ─────────────────────────────────────────────
function generateAnonAvatar() {
  const animals = ['fox', 'bear', 'owl', 'lion', 'tiger', 'panda', 'wolf', 'elephant', 'dog', 'cat'];
  return animals[Math.floor(Math.random() * animals.length)];
}

// ─────────────────────────────────────────────
// MongoDB Connection & Server Start
// ─────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI, {
  })
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));
