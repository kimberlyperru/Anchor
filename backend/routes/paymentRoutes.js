import 'dotenv/config';
console.log("✅ paymentRoutes.js file has been loaded."); // <-- ADD THIS LINE
import express from "express";
// Use express.Router() for modular routes
const router = express.Router();
import axios from "axios";

// env variables
const callbackUrl = process.env.CALLBACK_URL;

// This route is typically for a health check or base URL,
// it's now attached to the router.
router.get("/", (req, res) => {
  res.send("MPESA integration with Node");
  // Removed unnecessary timestamp logging
});

// Helper function to get the M-Pesa timestamp
function getMpesaTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// Access token function
async function getAccessToken() {
  const consumer_key = process.env.CONSUMER_KEY;
  const consumer_secret = process.env.CONSUMER_SECRET;
  const url =
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  const auth =
    "Basic " +
    Buffer.from(`${consumer_key}:${consumer_secret}`).toString("base64");

  try {
    const response = await axios.get(url, { headers: { Authorization: auth } });
    const accessToken = response.data.access_token;
    if (!accessToken) throw new Error("No access token in OAuth response");
    console.log("Generated Access Token:", accessToken);
    return accessToken;
  } catch (error) {
    console.error(
      "Error fetching access token:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Secure route for initiating payments based on a plan.
// This is the single, correct endpoint for starting a payment.
router.post("/init", async (req, res) => {
  const { plan, phoneNumber } = req.body;

  if (!plan || !phoneNumber) {
    console.error("Bad Request to /initiate-payment: Missing plan or phoneNumber. Received body:", req.body);
    return res.status(400).send("Plan and PhoneNumber are required.");
  }

  // Server-side price determination
  const planPrices = {
    premium: 10, // Example price for the premium plan (e.g., 10 KES)
    // Add other plans here, e.g., 'pro': 25
  };

  const amount = planPrices[plan.toLowerCase()];

  if (!amount) {
    console.error(`Invalid plan type received: ${plan}`);
    return res.status(400).send(`Invalid plan type: '${plan}'. Valid plans are: ${Object.keys(planPrices).join(', ')}`);
  }

  // Use a helper function to process the payment
  await processMpesaStkPush(res, { amount, phoneNumber, accountReference: `Plan: ${plan}` });
});

// Helper function to contain the STK Push logic
async function processMpesaStkPush(res, { amount, phoneNumber, accountReference, transactionDesc }) {
  // Basic input validation
  if (!amount || !phoneNumber) {
    console.error("Bad Request: Missing amount or phoneNumber. Received body:", req.body);
    return res.status(400).send("Amount and PhoneNumber are required.");
  }
  // You might want more robust phone number validation here (e.g., regex)

  try {
    const accessToken = await getAccessToken();
    const url =
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
    const auth = `Bearer ${accessToken}`;
    const timestamp = getMpesaTimestamp();
    const password = Buffer.from(
      process.env.BUSINESS_SHORT_CODE + process.env.PASSKEY + timestamp
    ).toString("base64");

    const response = await axios.post(
      url,
      {
        BusinessShortCode: process.env.BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount, // Dynamic from request body
        PartyA: phoneNumber, // Dynamic from request body
        PartyB: process.env.BUSINESS_SHORT_CODE,
        PhoneNumber: phoneNumber, // Dynamic from request body
        CallBackURL: `${callbackUrl}/callback`,
        AccountReference: accountReference || "Anchor Payment", // Dynamic or default
        TransactionDesc: transactionDesc || "Mpesa Daraja API STK Push", // Dynamic or default
      },
      {
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("STK Push Response:", response.data);
    res.send(
      "😀 Request is successful done ✔✔. Please enter M-Pesa PIN to complete the transaction"
    );
  } catch (error) {
    console.error(
      "STK Push Error:",
      error.response?.data || error.message
    );
    res.status(500).send("STK Push request failed");
  }
}

// STK Push Callback Handler
router.post("/callback", (req, res) => {
  const callbackData = req.body.Body?.stkCallback;
  if (!callbackData) {
    console.error("Invalid callback data received:", req.body); // Changed to error log
    return res.status(400).send("Invalid callback data");
  }

  const { ResultCode, ResultDesc, CheckoutRequestID } = callbackData;
  switch (ResultCode) {
    case "0":
      console.log(
        `✅ Transaction successful for CheckoutRequestID: ${CheckoutRequestID}`
      );
      console.log("Details:", callbackData);
      break;
    case "1032":
      console.log(
        `❌ Transaction declined by customer for CheckoutRequestID: ${CheckoutRequestID}`
      );
      console.log("Reason:", ResultDesc);
      break;
    case "1037":
      console.log(
        `⏳ Transaction timed out for CheckoutRequestID: ${CheckoutRequestID}`
      );
      console.log("Reason:", ResultDesc);
      break;
    default:
      console.log(
        `⚠️ Transaction failed for CheckoutRequestID: ${CheckoutRequestID}`
      );
      console.log("ResultCode:", ResultCode, "Reason:", ResultDesc);
      break;
  }

  // Acknowledge the callback to M-Pesa
  res.status(200).send("Callback received");
});

// Register URL for C2B
router.post("/registerurl", async (req, res) => { // Changed to POST
  const { shortCode } = req.body;

  // Basic input validation
  if (!shortCode) {
    return res.status(400).send("ShortCode is required.");
  }

  try {
    const accessToken = await getAccessToken();
    const url = "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl";
    const auth = `Bearer ${accessToken}`;

    const response = await axios.post(
      url,
      {
        ShortCode: shortCode, // Dynamic from request body
        ResponseType: "Completed",
        ConfirmationURL: `${callbackUrl}/confirmation`,
        ValidationURL: `${callbackUrl}/validation`,
      },
      {
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
      }
    );
    res.status(200).json(response.data);
  } catch (error) {
    console.error(
      "C2B Register Error:",
      error.response?.data || error.message
    );
    res.status(500).send("❌ C2B URL registration failed");
  }
});

router.post("/confirmation", (req, res) => {
  console.log("Confirmation Callback:", req.body);
  res.status(200).json({ ResultCode: "0", ResultDesc: "Success" });
});

router.post("/validation", (req, res) => {
  console.log("Validation Callback:", req.body);
  res.status(200).json({ ResultCode: "0", ResultDesc: "Success" });
});

// Export the router for use in server.js
export default router;