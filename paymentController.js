const axios = require('axios');
const createError = require('http-errors');
const Payment = require('../models/Payment');

/**
 * A mock function to simulate calling a payment provider API.
 * In a real application, this would contain the logic to call M-Pesa, PayPal, etc.
 * @param {string} provider The payment provider.
 * @param {number} amount The amount to charge.
 * @returns {Promise<object>} A promise that resolves with the provider's response.
 */
const callPaymentProvider = async (provider, amount) => {
  // This is a mock. Replace with actual API calls.
  console.log(`Initiating payment of ${amount} with ${provider}`);
  
  // Example of using axios to call a payment gateway
  // const response = await axios.post('https://api.paymentprovider.com/charge', { amount });
  // return response.data;

  // Simulate a successful payment for 'paypal' and a failed one for 'mpesa' for demonstration
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (provider === 'paypal') {
        resolve({
          success: true,
          transactionId: `txn_${Date.now()}` 
        });
      } else if (provider === 'mpesa') {
        reject(new Error('M-Pesa API timeout'));
      } else {
        reject(new Error('Unsupported provider'));
      }
    }, 2000);
  });
};

exports.initiatePayment = async (req, res, next) => {
  const { amount, provider } = req.body;
  const userId = req.user.id; // Assuming you have user information in the request

  if (!amount || !provider) {
    return next(createError(400, 'Amount and provider are required.'));
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
    const providerResponse = await callPaymentProvider(provider, amount);

    // 3. Handle successful payment
    if (providerResponse.success) {
      payment.status = 'success';
      // You might want to store a transaction ID from the provider
      // payment.checkoutRequestId = providerResponse.transactionId; 
      await payment.save();
      res.status(201).json({
        message: 'Payment successful',
        paymentId: payment._id,
      });
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