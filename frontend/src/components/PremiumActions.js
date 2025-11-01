import React, { useState, useEffect } from "react";
import API from "../utils/api";
import { Button, Form, Alert, Spinner, Fade } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { useSocket } from "../context/SocketContext"; // ✅ 1. Import useSocket
import styles from "./PremiumActions.module.css"; // ✅ Import CSS Module
 
export default function PremiumActions({ user }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState(null);
  const [alertVariant, setAlertVariant] = useState("info");
  const [loading, setLoading] = useState(false); // Keep loading state for the button
  const navigate = useNavigate();
  const { refreshUser } = useUser();
  const socket = useSocket(); // ✅ 2. Get the socket instance
 
  async function handleMpesaPayment(e) {
    e.preventDefault();
    setMessage("");
    setAlertVariant("info");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token || !user) {
        setMessage("⚠️ Please log in to make a payment.");
        setAlertVariant("warning");
        setLoading(false);
        return;
      }

      if (!phoneNumber.trim()) {
        setMessage("📱 Please enter your M-Pesa phone number.");
        setAlertVariant("warning");
        setLoading(false);
        return;
      }

      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      // ✅ Call backend (adjust route prefix if necessary)
      const res = await API.post(
        "/mpesa/stkpush",
        {
          amount: 300, // Assuming a fixed amount for premium
          provider: "mpesa",
          phoneNumber: phoneNumber.startsWith("254")
            ? phoneNumber
            : phoneNumber.replace(/^0/, "254"), // Normalize Kenyan number
        },
        config
      );

      setMessage("✅ Request sent. Check your phone to complete the payment. We'll redirect you automatically upon confirmation.");
      setAlertVariant("success");
      // No need to poll, just wait for the socket event.

    } catch (error) {
      console.error("❌ M-Pesa initiation failed:", error);
      const errorMessage = error.response?.data?.message || error.response?.data || "❌ Could not initiate payment. Please try again.";
      setMessage(typeof errorMessage === 'string' ? errorMessage : "❌ An unknown error occurred.");
      setAlertVariant("danger");
      setLoading(false); // Stop loading on initiation failure
    }
  }

  // ✅ 3. Listen for the 'paymentSuccess' event from the server
  useEffect(() => {
    if (!socket) return;

    const handlePaymentSuccess = async (data) => {
      console.log('Payment success event received:', data);
      setMessage("✅ Upgrade successful! You now have premium features. Redirecting...");
      setAlertVariant("success");
      await refreshUser(); // Refresh the user context
      navigate('/consultant');
    };
    socket.on('paymentSuccess', handlePaymentSuccess);
    return () => {
      socket.off('paymentSuccess', handlePaymentSuccess);
      setLoading(false);
    };
  }, [socket, navigate, refreshUser]);

  return (
    <Form onSubmit={handleMpesaPayment} className={styles.premiumForm}>
      <h5 className={`mb-4 text-center ${styles.formTitle}`}>
        Upgrade to Premium
      </h5>
      <Form.Group className="mb-3">
        <Form.Label>Enter your M-Pesa phone number</Form.Label>
        <Form.Control
          type="tel"
          placeholder="e.g. 254712345678"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
      </Form.Group>

      <Button
        type="submit"
        variant="success"
        disabled={loading || !phoneNumber}
        className={`w-100 ${styles.submitButton}`}
      >
        {loading ? (
          <>
            <Spinner
              as="span"
              animation="border"
              size="sm"
              role="status"
              aria-hidden="true"
              className={styles.spinner}
            />
            Processing...
          </>
        ) : (
          "Pay Ksh 300 via M-Pesa"
        )}
      </Button>

      <Fade in={!!message}>
        <div className="mt-3">
          {/* The div is for Fade to have a target, Alert can be null */}
          {message && <Alert variant={alertVariant}>{message}</Alert>}
        </div>
      </Fade>
    </Form>
  );
}
