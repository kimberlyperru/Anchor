import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './auth.js';
import { initiatePayment } from '../paymentController.js';
import Payment from '../models/payment.js';
import { initiateStkPush } from '../utils/mpesa.js';

const router = express.Router();

/**
 * This is a generic payment initiation endpoint.
 * It's protected and uses the logic from paymentController.
 */
router.post('/init', authMiddleware, initiatePayment);

// This is the M-Pesa STK Push initiation endpoint.
router.post('/stkpush', authMiddleware, async (req, res) => {
  const { amount, phone } = req.body; // userId is now extracted from token

  try {
    const token = req.headers.authorization.split(' ')[1]; // Get token from authMiddleware
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const actualUserId = decodedToken.userId; // Assuming userId is in the token

    console.log(`Initiating STK push for user ${actualUserId} of amount ${amount} to phone ${phone}`);

    const stkPushResponse = await initiateStkPush(phone, amount, actualUserId, 'Premium Subscription');
    console.log('STK Push Response:', stkPushResponse);

    // Create a pending payment record here with CheckoutRequestID
    await Payment.create({
      userId: actualUserId,
      provider: 'mpesa',
      amount: amount,
      checkoutRequestId: stkPushResponse.CheckoutRequestID, // Store this for callback matching
      status: 'pending',
    });

    res.status(200).json({ message: 'STK push initiated. Please check your phone to complete the payment.', data: stkPushResponse });
  } catch (mpesaError) {
    console.error('M-Pesa STK Push initiation failed:', mpesaError.message);
    return res.status(500).json({ message: 'Failed to initiate STK Push.', error: mpesaError.message });
  }
});


/**
 * M-Pesa Callback URL
 * This is the endpoint that M-Pesa will call after the transaction is complete.
 * It's the key to activating the user.
 */
router.post('/callback', async (req, res) => {
  console.log('M-Pesa callback received:', JSON.stringify(req.body, null, 2));
  const stkCallback = req.body.Body?.stkCallback;

  if (!stkCallback) {
    console.error('Invalid M-Pesa callback format received.');
    return res.json({ ResultCode: 1, ResultDesc: 'Rejected' });
  }

  const { ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

  // Extract metadata to find the user and transaction details
  const metadata = CallbackMetadata?.Item;
  const userId = metadata?.find(item => item.Name === 'AccountReference')?.Value;
  const mpesaReceiptNumber = metadata?.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
  const amount = metadata?.find(item => item.Name === 'Amount')?.Value;

  let paymentStatus = 'pending';
  let failureReason = null;

  // A. Check if the payment was successful
  if (ResultCode === 0) {
    paymentStatus = 'success';
    try {
      if (!userId) {
        console.error('Callback received but no UserId found in AccountReference.');
        // Still create a payment record even if userId is missing, but mark as failed or needing manual review
        await Payment.create({
          provider: 'mpesa',
          amount: amount,
          transactionId: mpesaReceiptNumber,
          status: 'failed',
          failureReason: 'UserId missing in callback',
        });
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' }); // Acknowledge receipt
      }

      const user = await User.findById(userId);
      if (!user) {
        console.error(`User with ID ${userId} not found for activation.`);
        await Payment.create({
          userId: userId,
          provider: 'mpesa',
          amount: amount,
          transactionId: mpesaReceiptNumber,
          status: 'failed',
          failureReason: `User with ID ${userId} not found`,
        });
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      // Create a successful payment record
      await Payment.create({
        userId: userId,
        provider: 'mpesa',
        amount: amount,
        transactionId: mpesaReceiptNumber,
        status: paymentStatus,
      });

      // C. Determine if it was a premium or standard signup payment
      const updates = { isActive: true };
      if (user.isPremium) {
        const premiumExpiry = new Date();
        premiumExpiry.setDate(premiumExpiry.getDate() + 30); // Set premium for 30 days
        updates.premiumUntil = premiumExpiry;
        console.log(`Activating premium user ${user.email} until ${premiumExpiry.toISOString()}`);
      } else {
        console.log(`Activating standard user ${user.email}`);
      }

      // D. Update the user in the database
      await User.findByIdAndUpdate(userId, { $set: updates });

    } catch (error) {
      console.error('Error processing successful M-Pesa callback:', error);
      // If an error occurs during user update, still record the payment as failed or needing review
      await Payment.create({
        userId: userId,
        provider: 'mpesa',
        amount: amount,
        transactionId: mpesaReceiptNumber,
        status: 'failed',
        failureReason: `Error during user activation: ${error.message}`,
      });
    }
  } else {
    // Log failed transaction
    console.log('M-Pesa transaction failed with code:', ResultCode, ResultDesc);
    paymentStatus = 'failed';
    failureReason = ResultDesc;

    // Create a failed payment record
    await Payment.create({
      userId: userId,
      provider: 'mpesa',
      amount: amount,
      transactionId: mpesaReceiptNumber,
      status: paymentStatus,
      failureReason: failureReason,
    });
  }

  // E. Always respond to M-Pesa to acknowledge receipt of the callback
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

export default router;