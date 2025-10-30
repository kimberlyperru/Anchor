import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  provider: {
    type: String,
    enum: ['mpesa'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  checkoutRequestId: String, // For IntaSend checkout session
  transactionId: String, // For IntaSend transaction tracking
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
  },
  failureReason: String,
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);