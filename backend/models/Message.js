import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', index: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  avatar: { type: String }, // animal name
  content: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Message', MessageSchema);
