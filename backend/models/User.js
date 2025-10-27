import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  avatar: {
    type: String,
    default: 'fox',
  },
  isPremium: {
    type: Boolean,
    default: false,
  },
  premiumUntil: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

export default mongoose.model('User', userSchema);