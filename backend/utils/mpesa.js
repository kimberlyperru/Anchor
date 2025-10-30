import axios from 'axios';
import dotenv from 'dotenv';



const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
const shortCode = process.env.BUSINESS_SHORT_CODE; // Your M-Pesa Paybill or Till Number
const passkey = process.env.PASSKEY; // Your M-Pesa STK Push Passkey
const callbackUrl = process.env.CALLBACK_URL; // Your callback URL for M-Pesa

// Function to generate M-Pesa access token
const generateAccessToken = async () => {
  try {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    console.log('M-Pesa Consumer Key:', consumerKey);
    console.log('M-Pesa Consumer Secret:', consumerSecret);
    console.log('M-Pesa Auth String (Base64):', auth);
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Error generating M-Pesa access token:', error.response?.data || error.message);
    throw new Error('Failed to generate M-Pesa access token.');
  }
};

// Function to initiate STK Push
export const initiateStkPush = async (phoneNumber, amount, accountReference, transactionDesc) => {
  try {
    const accessToken = await generateAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline', // Or 'CustomerBuyGoodsOnline'
        Amount: amount,
        PartyA: phoneNumber, // Phone number initiating the transaction
        PartyB: shortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: callbackUrl,
        AccountReference: accountReference, // Your internal account reference
        TransactionDesc: transactionDesc,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error initiating STK Push:', error.response?.data || error.message);
    throw new Error('Failed to initiate STK Push.');
  }
};
