import mongoose from 'mongoose';

const ChatSchema = new mongoose.Schema({
  title: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Chat', ChatSchema);
