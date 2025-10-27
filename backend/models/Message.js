import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  avatar: { type: String }, // animal name
  content: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Message', MessageSchema);
