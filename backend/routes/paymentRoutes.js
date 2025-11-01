import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './auth.js';
import createError from '../utils/createError.js';
import Payment from '../models/payment.js';
import { initiateStkPush } from '../utils/mpesa.js';

const router = express.Router();
console.log('paymentRoutes.js loaded, defining /init route');

/**
 * This is the M-Pesa STK Push initiation endpoint.
 */
router.post('/init', authMiddleware, async (req, res, next) => {
  const { amount, phoneNumber } = req.body; 
  const actualUserId = req.user.id; // Use the user ID from authMiddleware

  try {
    if (!amount || !phoneNumber) {
      return next(createError(400, 'Amount and phoneNumber are required.'));
    }

    console.log(`Initiating STK push for user ${actualUserId} of amount ${amount} to phone ${phoneNumber}`);

    const stkPushResponse = await initiateStkPush(phoneNumber, amount, actualUserId, 'Premium Subscription');
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
    return next(createError(500, `Failed to initiate STK Push: ${mpesaError.message}`));
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

  const { ResultCode, ResultDesc, CallbackMetadata, CheckoutRequestID } = stkCallback;

  // Extract metadata to find the user and transaction details
  const metadata = CallbackMetadata?.Item;
  const userId = metadata?.find(item => item.Name === 'AccountReference')?.Value;
  const mpesaReceiptNumber = metadata?.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
  const amount = metadata?.find(item => item.Name === 'Amount')?.Value;

  // Find the original payment record using the CheckoutRequestID
  const payment = await Payment.findOne({ checkoutRequestId: CheckoutRequestID });

  if (!payment) {
    console.error(`Callback received for unknown CheckoutRequestID: ${CheckoutRequestID}`);
    // Acknowledge receipt to M-Pesa but take no further action.
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  // Idempotency Check: If payment is already successful, do nothing further.
  if (payment.status === 'success') {
    console.log(`Callback for already processed CheckoutRequestID: ${CheckoutRequestID}. Acknowledging and exiting.`);
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  // A. Check if the payment was successful
  if (ResultCode === 0) {
    payment.status = 'success';
    payment.transactionId = mpesaReceiptNumber;

    try {
      const user = await User.findById(payment.userId);
      if (!user) {
        throw new Error(`User with ID ${payment.userId} not found for activation.`);
      }

      // C. Grant premium access
      const updates = { isActive: true, isPremium: true };
      const premiumExpiry = new Date();
      premiumExpiry.setDate(premiumExpiry.getDate() + 30); // Set premium for 30 days
      updates.premiumUntil = premiumExpiry;
      console.log(`Activating premium for user ${user.email} until ${premiumExpiry.toISOString()}`);

      // D. Update the user in the database
      await User.findByIdAndUpdate(payment.userId, { $set: updates });
      console.log(`Successfully activated user ${payment.userId}`);

    } catch (error) {
      console.error('Error processing successful M-Pesa callback:', error);
      payment.status = 'failed';
      payment.failureReason = `Error during user activation: ${error.message}`;
    } finally {
      await payment.save();
      if (payment.status === 'failed') {
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }
    }
  } else {
    // Log failed transaction
    console.log('M-Pesa transaction failed with code:', ResultCode, ResultDesc);
    payment.status = 'failed';
    payment.failureReason = ResultDesc;
    await payment.save();
  }

  // E. Always respond to M-Pesa to acknowledge receipt of the callback
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

export default router;