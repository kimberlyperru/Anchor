const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const chatRoutes = require('./routes/chat');
const moderationRoutes = require('./routes/moderation');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/mod', moderationRoutes);

// Socket.io realtime chat
const Chat = require('./models/Chat');
const Message = require('./models/Message');

io.on('connection', socket => {
  console.log('socket connected', socket.id);

  // join a room for a given chat thread (e.g., post ID)
  socket.on('joinRoom', ({ roomId }) => {
    socket.join(roomId);
  });

  socket.on('leaveRoom', ({ roomId }) => {
    socket.leave(roomId);
  });

  // new message
  socket.on('message', async ({ token, roomId, content, parentId }) => {
    try {
      // basic auth optional: accept token to fetch user id+avatar
      let userPayload = null;
      if (token) {
        try { userPayload = jwt.verify(token, process.env.JWT_SECRET); } catch (e) { userPayload = null; }
      }

      // moderation/filtering
      const { filterText } = require('./utils/moderation');
      const cleaned = filterText(content);

      const msg = new Message({
        chatId: roomId,
        authorId: userPayload ? userPayload.id : null,
        avatar: userPayload ? userPayload.avatar : generateAnonAvatar(),
        content: cleaned,
        parentId: parentId || null,
        createdAt: new Date()
      });
      await msg.save();

      // broadcast message to room
      io.to(roomId).emit('message', {
        id: msg._id,
        chatId: roomId,
        avatar: msg.avatar,
        content: msg.content,
        parentId: msg.parentId,
        createdAt: msg.createdAt
      });

    } catch (err) {
      console.error('socket message error', err);
      socket.emit('error', { message: 'Message failed' });
    }
  });

  socket.on('disconnect', () => {
    // cleanup if needed
  });
});

function generateAnonAvatar() {
  // choose random animal icon name - frontend maps name -> animated icon
  const animals = ['fox','bear','owl','lion','tiger','panda','wolf','elephant','dog','cat'];
  return animals[Math.floor(Math.random() * animals.length)];
}

// connect db and start
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> {
    console.log('Mongo connected');
    server.listen(PORT, ()=> console.log(`Server on ${PORT}`));
  })
  .catch(err => console.error(err));
