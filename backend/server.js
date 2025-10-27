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
app.use('/api/mpesa', paymentRoutes);
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

// Socket.IO Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = payload; // Attach user payload to the socket object
    } catch (err) {
      console.warn('Socket connection with invalid token.');
      // Allow connection but as an unauthenticated user
    }
  }
  next();
});

io.on('connection', (socket) => {
  console.log(`🟢 Socket connected: ${socket.id}`);

  // Join a chat room (thread)
  socket.on('joinRoom', ({ roomId }) => socket.join(roomId));

  // Leave a room
  socket.on('leaveRoom', ({ roomId }) => socket.leave(roomId));

  // New message event
  socket.on('message', async ({ roomId, content, parentId }) => {
    try {
      const user = socket.user; // Get user from the authenticated socket
      const cleaned = filterText(content);

      const msg = new Message({
        chatId: roomId,
        authorId: user ? user.id : null,
        avatar: user ? user.avatar : generateAnonAvatar(),
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
  socket.on('deleteMessage', async ({ messageId, roomId }) => {
    try {
      const user = socket.user;
      if (!user) return; // Only authenticated users can delete
      const message = await Message.findById(messageId);
      if (!message) return;

      if (message.authorId?.toString() === user.id) {
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
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error('Another application (or another instance of this one) is running on this port.');
        console.error('Please stop the other process or use a different port.');
        process.exit(1);
      } else {
        console.error('❌ Server error:', err);
      }
    });
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));
