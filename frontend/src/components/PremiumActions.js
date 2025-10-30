import React, { useState, useEffect } from "react";
import API from "../utils/api";
import { Button, Form, Alert, Spinner, Fade } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext"; // ✅ Import useUser
import styles from "./PremiumActions.module.css"; // ✅ Import CSS Module
 
export default function PremiumActions({ user }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [alertVariant, setAlertVariant] = useState("info");
  const [isPolling, setIsPolling] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useUser(); // ✅ Get refresh function
 
  async function handleMpesaPayment(e) {
    e.preventDefault();
    setMessage("");
    setAlertVariant("info");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
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

      setMessage("✅ Request sent. Check your phone to complete payment and wait for confirmation.");
      setAlertVariant("success");
      setIsPolling(true); // Start polling

    } catch (error) {
      console.error("❌ M-Pesa initiation failed:", error);
      // Ensure message is always a string
      const errorMessage = error.response?.data?.message || error.response?.data || "❌ Could not initiate payment. Please try again.";
      setMessage(typeof errorMessage === 'string' ? errorMessage : "❌ An unknown error occurred.");
      setAlertVariant("danger");
    }
    // Keep loading true while polling
  }

  // ✅ Use useEffect for polling to handle component lifecycle
  useEffect(() => {
    if (!isPolling) return;

    let timeout;

    const pollInterval = setInterval(async () => {
      try {
        // ✅ Poll the correct, unauthenticated endpoint
        const { data: updatedUser } = await API.get(`/auth/me-unactivated/${user._id}`);
        if (updatedUser.isPremium && new Date(updatedUser.premiumUntil) > new Date()) {
          clearInterval(pollInterval);
          clearTimeout(timeout);
          setMessage("✅ Upgrade successful! You now have premium features. Redirecting...");
          setAlertVariant("success");
          await refreshUser(); // ✅ Refresh the user context to get new premium status
          navigate('/consultant');
        }
      } catch (err) {
        console.error("Polling for premium status failed:", err);
        clearInterval(pollInterval);
        clearTimeout(timeout);
        setLoading(false);
        setIsPolling(false);
        setMessage("❌ Error checking payment status. Please refresh and check your account.");
        setAlertVariant("danger");
      }
    }, 3000); // Poll every 3 seconds

    timeout = setTimeout(() => {
      clearInterval(pollInterval);
      setLoading(false);
      setIsPolling(false);
      setMessage("⏳ Payment confirmation timed out. If you paid, please refresh the page. Otherwise, please try again.");
      setAlertVariant("warning");
    }, 60000); // 60-second timeout

    // Cleanup function to clear interval and timeout on unmount
    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [isPolling, navigate, user, refreshUser]);

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
