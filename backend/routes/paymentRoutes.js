import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

const router = express.Router();

// ✅ Environment variables
const {
  CONSUMER_KEY,
  CONSUMER_SECRET,
  BUSINESS_SHORT_CODE,
  PASSKEY,
  CALLBACK_URL,
} = process.env;

// ✅ Health check
router.get("/", (req, res) => {
  res.send("✅ MPESA integration is running.");
});

// ✅ Helper: timestamp
function getMpesaTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[-T:\.Z]/g, "").slice(0, 14);
}

// ✅ Helper: access token
async function getAccessToken() {
  const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  const auth = "Basic " + Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

  try {
    const response = await axios.get(url, { headers: { Authorization: auth } });
    const token = response.data.access_token;
    if (!token) throw new Error("No access token returned from Safaricom");
    console.log("🎟️  Access token generated successfully.");
    return token;
  } catch (err) {
    console.error("❌ Error fetching access token:", err.response?.data || err.message);
    throw err;
  }
}

// ✅ Payment initiation route
router.post("/init", async (req, res) => {
  console.log("📩 Received body in /mpesa/init:", req.body);

  const { plan, phoneNumber, userId } = req.body;
  if (!plan || !phoneNumber || !userId) {
    console.error("❌ Missing plan, phoneNumber, or userId.");
    return res.status(400).send("Plan, phoneNumber, and userId are required.");
  }

  // ✅ Example plan pricing
  const planPrices = {
    premium: 10,
    "signup-free": 1,
  };
  const amount = planPrices[plan.toLowerCase()] || 1;

  try {
    const response = await processMpesaStkPush({
      amount,
      phoneNumber,
      accountReference: `Plan: ${plan}`,
      userId,
    });

    return res.status(200).json(response);
  } catch (err) {
    console.error("❌ STK Push initiation failed:", err.message);
    return res.status(500).send("Failed to initiate STK Push.");
  }
});

// ✅ Helper: Process STK Push
async function processMpesaStkPush({ amount, phoneNumber, accountReference, userId }) {
  const accessToken = await getAccessToken();
  const url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
  const auth = `Bearer ${accessToken}`;
  const timestamp = getMpesaTimestamp();
  const password = Buffer.from(BUSINESS_SHORT_CODE + PASSKEY + timestamp).toString("base64");

  const payload = {
    BusinessShortCode: BUSINESS_SHORT_CODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: BUSINESS_SHORT_CODE,
    PhoneNumber: phoneNumber,
    CallBackURL: `${CALLBACK_URL}?userId=${userId}`,
    AccountReference: accountReference || "Anchor Payment",
    TransactionDesc: "Mpesa Daraja STK Push",
  };

  console.log("📤 Sending STK Push request to Safaricom...");

  const response = await axios.post(url, payload, { headers: { Authorization: auth } });
  console.log("✅ STK Push Response:", response.data);

  return {
    message: "Request successful. Please check your phone and enter your M-Pesa PIN.",
    checkoutRequestID: response.data.CheckoutRequestID,
  };
}

// ✅ STK Callback handler
router.post("/callback", async (req, res) => {
  console.log("📞 STK Callback received:", JSON.stringify(req.body, null, 2));
  const { userId } = req.query;

  const callbackData = req.body.Body?.stkCallback;
  if (!callbackData) {
    console.error("⚠️ Invalid callback payload:", req.body);
    return res.status(400).send("Invalid callback data");
  }

  const { ResultCode, ResultDesc, CheckoutRequestID } = callbackData;
  const metadata = callbackData.CallbackMetadata?.Item || [];
  const amount = metadata.find(i => i.Name === "Amount")?.Value;
  const mpesaReceiptNumber = metadata.find(i => i.Name === "MpesaReceiptNumber")?.Value;

  if (ResultCode === 0) {
    console.log(`✅ Transaction successful for CheckoutRequestID: ${CheckoutRequestID}`);

    if (userId) {
      try {
        const user = await User.findById(userId);
        if (user) {
          user.isActive = true;
          if (user.isPremium) {
            const oneMonthFromNow = new Date();
            oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
            user.premiumUntil = oneMonthFromNow;
          }
          await user.save();
          console.log(`👤 User ${user.email} activated successfully.`);

          await Transaction.create({
            userId: user._id,
            amount,
            provider: "mpesa",
            transactionId: mpesaReceiptNumber,
            status: "success",
          });
        }
      } catch (err) {
        console.error("❌ Error updating user after payment:", err);
      }
    }
  } else {
    console.log(`⚠️ Transaction failed (${ResultCode}): ${ResultDesc}`);
  }

  // Acknowledge Safaricom
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// ✅ Register C2B URLs
router.post("/registerurl", async (req, res) => {
  const { shortCode } = req.body;
  if (!shortCode) return res.status(400).send("ShortCode is required.");

  try {
    const accessToken = await getAccessToken();
    const url = "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl";
    const auth = `Bearer ${accessToken}`;

    const payload = {
      ShortCode: shortCode,
      ResponseType: "Completed",
      ConfirmationURL: `${CALLBACK_URL}/confirmation`,
      ValidationURL: `${CALLBACK_URL}/validation`,
    };

    const response = await axios.post(url, payload, {
      headers: { Authorization: auth, "Content-Type": "application/json" },
    });

    res.status(200).json(response.data);
  } catch (err) {
    console.error("❌ Error registering C2B URLs:", err.response?.data || err.message);
    res.status(500).send("C2B registration failed.");
  }
});

// ✅ Validation and confirmation routes
router.post("/confirmation", (req, res) => {
  console.log("🟢 Confirmation Callback:", req.body);
  res.status(200).json({ ResultCode: "0", ResultDesc: "Success" });
});

router.post("/validation", (req, res) => {
  console.log("🟣 Validation Callback:", req.body);
  res.status(200).json({ ResultCode: "0", ResultDesc: "Success" });
});

export default router;
