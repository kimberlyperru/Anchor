import express from 'express';
import axios from 'axios';
import createError from 'http-errors';
import Payment from './models/payment.js';
import mongoose from 'mongoose';
import User from './models/User.js';
import { initiateStkPush } from './utils/mpesa.js';

/**
 * A mock function to simulate calling a payment provider API.
 * In a real application, this would contain the logic to call M-Pesa, PayPal, etc.
 * @param {string} provider The payment provider.
 * @param {number} amount The amount to charge.
 * @returns {Promise<object>} A promise that resolves with the provider's response.
 */
const callPaymentProvider = async (provider, amount, phoneNumber, userId) => {
  console.log(`Initiating payment of ${amount} with ${provider}`);

  if (provider === 'mpesa') {
    // M-Pesa STK Push is initiated via a separate endpoint (/stkpush)
    // This function should not directly call initiateStkPush for M-Pesa.
    // The payment record will be created as 'pending' and updated by the M-Pesa callback.
    return {
      success: true, // Indicate that the initiation request was successfully processed (not payment success)
      message: 'M-Pesa STK Push initiation handled by separate endpoint.'
    };
  } else if (provider === 'paypal') {
    // Existing PayPal mock logic
    return {
      success: true,
      transactionId: `txn_${Date.now()}`
    };
  } else {
    throw new Error('Unsupported provider');
  }
};

export const initiatePayment = async (req, res, next) => {
  const { amount, provider, phoneNumber } = req.body;
  const userId = req.user.id; // Assuming you have user information in the request

  if (!amount || !provider || !phoneNumber) {
    return next(createError(400, 'Amount, provider, and phoneNumber are required.'));
  }

  // 1. Create a new payment record with 'pending' status
  const payment = new Payment({
    userId,
    amount,
    provider,
    status: 'pending',
  });

  try {
    await payment.save();

    // 2. Call the payment provider's API
    const providerResponse = await callPaymentProvider(provider, amount, phoneNumber, userId);

    // 3. Handle successful payment
    if (providerResponse.success) {
      if (provider === 'mpesa') {
        // For M-Pesa, the actual success is determined by the callback
        // We just initiated the STK push, so keep status as 'pending'
        // and do not update user's premium status here.
        res.status(200).json({
          message: 'M-Pesa STK Push initiated. Awaiting callback for final status.',
          paymentId: payment._id,
        });
      } else {
        // For other providers (like PayPal mock), update status to success and user's premium
        payment.status = 'success';
        // You might want to store a transaction ID from the provider
        payment.transactionId = providerResponse.transactionId; // Example
        
        // Update user's premium status
        const userToUpdate = await User.findById(userId);
        if (userToUpdate) {
          userToUpdate.isPremium = true;
          // Set premiumUntil to one month from now
          const premiumUntilDate = new Date();
          premiumUntilDate.setMonth(premiumUntilDate.getMonth() + 1);
          userToUpdate.premiumUntil = premiumUntilDate;
          await userToUpdate.save();
        }

        await payment.save(); // Save payment record after all updates

        res.status(201).json({
          message: 'Payment successful',
          paymentId: payment._id,
        });
      }
    } else {
      // This case is for when the provider responds but indicates a failure
      throw new Error(providerResponse.message || 'Payment provider declined the transaction.');
    }
  } catch (error) {
    // 4. Handle any error during the process
    payment.status = 'failed';
    payment.failureReason = error.message || 'An unknown error occurred.';
    await payment.save();

    // Log the full error for debugging
    console.error('Payment processing failed:', error);

    // Return a user-friendly error
    return next(createError(500, `Payment failed: ${error.message}`));
  }
};