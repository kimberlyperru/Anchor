import express from 'express';
const router = express.Router();
import IntaSend from 'intasend-node';
import Payment from '../models/payment.js'; // Use lowercase 'payment'
import User from '../models/User.js';
import { authMiddleware } from './auth.js';
import jwt from 'jsonwebtoken';

// Initialize IntaSend with your API keys from environment variables
const intasend = new IntaSend(
  process.env.INTASEND_PUBLIC_KEY,
  process.env.INTASEND_SECRET_KEY,
  true // Use false for production
);

// @desc    Initiate IntaSend payment
// @route   POST /api/payments/intasend/init
// @access  Private
router.post('/intasend/init', authMiddleware, async (req, res) => {
  const { amount, purpose, email } = req.body;
  const userId = req.user._id;

  if (!amount || !purpose || !email) {
    return res.status(400).json({ message: 'Amount, purpose, and email are required.' });
  }

  try {
    // Create a new payment record in your database
    const payment = new Payment({
      userId,
      amount,
      provider: 'intasend',
      status: 'pending',
    });
    await payment.save();

    // Frontend URL where user is redirected after payment
    const redirectUrl = `${process.env.FRONTEND_URL}/payment-status?payment_id=${payment._id}`;
    const webhookUrl = `${process.env.BACKEND_URL}/api/payments/intasend/webhook`;

    // Create a checkout session with IntaSend
    const response = await intasend.checkout().create({
      currency: 'KES',
      amount,
      email,
      redirect_url: redirectUrl,
      api_ref: payment._id.toString(), // Use your internal payment ID as a reference
      method: 'M-PESA' // Or 'CARD', 'BANK' etc.
    });

    // Save the checkout ID from IntaSend to your payment record
    payment.checkoutRequestId = response.id;
    await payment.save();

    res.json({ redirectUrl: response.url });

  } catch (error) {
    console.error('IntaSend initiation error:', error);
    res.status(500).json({ message: 'Failed to initiate IntaSend payment.' });
  }
});

// @desc    IntaSend webhook for payment confirmation
// @route   POST /api/payments/intasend/webhook
// @access  Public
router.post('/intasend/webhook', async (req, res) => {
  try {
    // It's good practice to validate the webhook signature to ensure it's from IntaSend
    // For simplicity, we'll proceed with the data.
    const { invoice_id, state, api_ref, transaction_id } = req.body;
    console.log('IntaSend Webhook Received:', { invoice_id, state, api_ref });

    if (!api_ref) {
      console.warn('Webhook received without api_ref (payment_id).');
      return res.status(400).send('Bad Request: Missing api_ref.');
    }

    // Find the payment using the api_ref which is our internal payment._id
    const payment = await Payment.findById(api_ref);
    if (!payment) {
      console.error(`Webhook Error: Payment not found for api_ref: ${api_ref}`);
      return res.status(404).send('Payment record not found.');
    }

    // Prevent processing the same webhook multiple times
    if (payment.status === 'success') {
      console.log(`Webhook Info: Payment ${api_ref} already processed.`);
      return res.status(200).send('OK');
    }

    if (state === 'COMPLETE') {
      payment.status = 'success';
      payment.transactionId = transaction_id; // Store IntaSend's transaction ID

      // Find the user and update their status
      const user = await User.findById(payment.userId);
      if (user) {
        user.isPremium = true;
        // You could add more logic here, e.g., setting a `premiumUntil` date
        await user.save();
      }
    } else if (state === 'FAILED') {
      payment.status = 'failed';
      payment.failureReason = req.body.failure_reason || 'Unknown reason from IntaSend';
    }
    await payment.save();
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing IntaSend webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;