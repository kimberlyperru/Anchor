import express from 'express';
import User from '../models/User.js';
import { authMiddleware } from './auth.js';
import createError from '../utils/createError.js';
import Payment from '../models/payment.js';
import { initiateStkPush } from '../utils/mpesa.js';

const router = express.Router();
console.log('paymentRoutes.js loaded, defining /init route');

// ─────────────────────────────────────────────
// STK PUSH INITIATION ROUTE
// ─────────────────────────────────────────────
router.post('/init', authMiddleware, async (req, res, next) => {
  const { amount, phoneNumber } = req.body; 
  const actualUserId = req.user.id; // User ID from authMiddleware

  try {
    if (!amount || !phoneNumber) {
      return next(createError(400, 'Amount and phoneNumber are required.'));
    }
    
    // Log initiation details for debugging
    console.log(`[STK-INIT] Requesting push for user ${actualUserId}.`);

    const stkPushResponse = await initiateStkPush(phoneNumber, amount, actualUserId, 'Premium Subscription');
    const checkoutRequestId = stkPushResponse.CheckoutRequestID;
    
    // Validate immediate response status
    if (stkPushResponse.ResponseCode !== '0') {
      throw new Error(`M-Pesa rejected STK request: ${stkPushResponse.ResponseDescription}`);
    }

    // Create a pending payment record
    await Payment.create({
      userId: actualUserId,
      provider: 'mpesa',
      amount: amount,
      checkoutRequestId: checkoutRequestId, // Store this for callback matching
      status: 'pending',
    });

    res.status(200).json({ 
        message: 'STK push initiated. Please check your phone.', 
        checkoutRequestId: checkoutRequestId 
    });

  } catch (mpesaError) {
    console.error('[STK-INIT] M-Pesa STK Push initiation failed:', mpesaError.message);
    return next(createError(500, `Failed to initiate payment: ${mpesaError.message}`));
  }
});

// ─────────────────────────────────────────────
// M-PESA CALLBACK (WEBHOOK) ROUTE
// ─────────────────────────────────────────────
router.post('/callback', async (req, res) => {
  
    // 🛑 CRITICAL FIX: RESPOND INSTANTLY (HTTP 200 OK)
    // Acknowledge receipt to M-Pesa immediately to prevent timeout/retries.
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' }); 

    // --- START ASYNCHRONOUS BACKGROUND PROCESSING ---
    try {
        const fullBody = req.body;
        const stkCallback = fullBody?.Body?.stkCallback;

        if (!stkCallback) {
            console.error('[STK-CALLBACK-BG] Invalid M-Pesa callback format received.');
            return; 
        }

        const { ResultCode, ResultDesc, CallbackMetadata, CheckoutRequestID } = stkCallback;
        
        // Find the original payment record using the CheckoutRequestID
        const payment = await Payment.findOne({ checkoutRequestId: CheckoutRequestID });

        if (!payment) {
            console.error(`[STK-CALLBACK-BG] Unknown CheckoutRequestID: ${CheckoutRequestID}. Ignoring.`);
            return;
        }

        // 1. Idempotency Check
        if (payment.status !== 'pending') {
            console.log(`[STK-CALLBACK-BG] ${CheckoutRequestID} already processed (Status: ${payment.status}). Exiting.`);
            return; 
        }

        // 2. Process Result
        if (ResultCode === 0) {
            const metadata = CallbackMetadata?.Item;
            const mpesaReceiptNumber = metadata?.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
            
            payment.status = 'success';
            payment.transactionId = mpesaReceiptNumber;
            
            console.log(`[STK-CALLBACK-BG] SUCCESS: ${CheckoutRequestID}. Receipt: ${mpesaReceiptNumber}. Activating user ${payment.userId}.`);
            
            // 3. User Activation Logic
            const premiumExpiry = new Date();
            premiumExpiry.setDate(premiumExpiry.getDate() + 30); // Set premium for 30 days
            
            await User.findByIdAndUpdate(payment.userId, { 
                $set: { isActive: true, isPremium: true, premiumUntil: premiumExpiry } 
            });

        } else {
            // Transaction failed (User cancelled, Insufficient Funds, etc.)
            console.log(`[STK-CALLBACK-BG] FAILED: ${CheckoutRequestID}. Code: ${ResultCode}, Desc: ${ResultDesc}`);
            payment.status = 'failed';
            payment.failureReason = ResultDesc;
        }
        
        // 4. Save the final payment status
        await payment.save();
        console.log(`[STK-CALLBACK-BG] ${CheckoutRequestID} status updated to: ${payment.status}`);

    } catch (error) {
        // Log severe errors during background DB processing.
        console.error('[STK-CALLBACK-BG] FATAL ERROR during background processing:', error);
    }
    // --- END ASYNCHRONOUS BACKGROUND PROCESSING ---
});

export default router;