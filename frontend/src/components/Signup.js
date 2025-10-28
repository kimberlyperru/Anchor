import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import avatarImages from '../utils/avatars';

const avatars = ['fox', 'bear', 'owl', 'lion', 'tiger', 'panda', 'wolf', 'elephant', 'dog', 'cat'];

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('fox');
  const [error, setError] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const nav = useNavigate();
  const [phone, setPhone] = useState('');

  const [paymentDetails, setPaymentDetails] = useState(null);

  // ✅ Poll backend to see if user was activated after payment
  useEffect(() => {
  if (!paymentDetails?.isPolling) return;

  const interval = setInterval(async () => {
    try {
      const response = await API.get(`/auth/me-unactivated/${paymentDetails.userId}`);
      if (response.data?.isActive) {
        clearInterval(interval);
        // Auto-login user
        const loginRes = await API.post('/auth/login', {
          email: paymentDetails.email,
          password,
        });
        localStorage.setItem('token', loginRes.data.token);
        nav(loginRes.data.user.isPremium ? '/consultant' : '/dashboard');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        console.log("User not yet activated — will check again...");
      } else {
        console.error("Polling error:", err);
      }
    }
  }, 5000);

  return () => clearInterval(interval);
}, [paymentDetails, nav, email, password]);

  async function handleSignup(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await API.post('/auth/signup', { email, password, avatar, isPremium });

      // ✅ Handle signup result
      if (response.data.paymentDetails) {
        setPaymentDetails({ ...response.data.paymentDetails, email });
      } else if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        nav('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  const handlePayment = async () => {
    setError('');
    setLoading(true);

    try {
      if (!/^254\d{9}$/.test(phone)) {
        setError('Please enter a valid phone number (format: 254xxxxxxxxx).');
        setLoading(false);
        return;
      }

      // ✅ Initiate M-Pesa payment
      const res = await API.post('/mpesa/init', {
        plan: isPremium ? 'premium' : 'signup-free',
        phoneNumber: phone,
        userId: paymentDetails.userId,
      });

      alert(res.data.message || 'STK Push initiated. Enter your M-Pesa PIN to complete payment.');
      setPaymentDetails(prev => ({ ...prev, isPolling: true }));
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred during payment.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Render payment or signup UI
  if (paymentDetails) {
    if (paymentDetails.isPolling) {
      return (
        <Card className="p-3 text-center">
          <Card.Body>
            <Card.Title>Awaiting Payment Confirmation</Card.Title>
            <Card.Text>
              Please complete the M-Pesa payment on your phone. This page will update automatically once
              the payment is confirmed.
            </Card.Text>
            {isLoading && (
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            )}
          </Card.Body>
        </Card>
      );
    }

    return (
      <Card className="p-3">
        <Card.Body>
          <Card.Title>Complete Your Signup</Card.Title>
          <Card.Text>
            Your account is created. Please complete the payment of <strong>Ksh {paymentDetails.amount}</strong> to
            activate your account.
          </Card.Text>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>M-Pesa Phone Number</Form.Label>
            <Form.Control
              type="tel"
              placeholder="254712345678"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              disabled={isLoading}
            />
          </Form.Group>
          <Button onClick={handlePayment} disabled={isLoading || !phone}>
            {isLoading ? 'Processing...' : `Pay Ksh ${paymentDetails.amount} with M-Pesa`}
          </Button>
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className="p-3">
      <h3>Sign up</h3>
      <Form onSubmit={handleSignup}>
        <Form.Group className="mb-2">
          <Form.Label>Email</Form.Label>
          <Form.Control
            value={email}
            onChange={e => {
              setEmail(e.target.value);
              setError('');
            }}
            required
            isInvalid={!!error}
          />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              setError('');
            }}
            required
            isInvalid={!!error}
          />
          {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Check
            type="radio"
            label="Free Account"
            name="accountType"
            checked={!isPremium}
            onChange={() => setIsPremium(false)}
          />
          <Form.Check
            type="radio"
            label="Premium Account"
            name="accountType"
            checked={isPremium}
            onChange={() => setIsPremium(true)}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Pick an avatar (anonymous)</Form.Label>
          <div className="d-flex gap-2 flex-wrap">
            {avatars.map(a => (
              <div
                key={a}
                onClick={() => setAvatar(a)}
                style={{
                  cursor: 'pointer',
                  textAlign: 'center',
                  width: 80,
                  padding: 6,
                  border: avatar === a ? '2px solid #0d6efd' : '1px solid #ddd',
                  borderRadius: 8,
                  background: avatar === a ? '#f0f8ff' : 'transparent',
                }}
              >
                <img src={avatarImages[a]} alt={a} style={{ width: 60, height: 60 }} />
                <div style={{ fontSize: 12 }}>{a}</div>
              </div>
            ))}
          </div>
        </Form.Group>

        <div className="mb-3">
          {isPremium ? (
            <span>
              Premium subscription: <strong>Ksh 300 / month</strong>. (Demo: no real charge)
            </span>
          ) : (
            <span>
              Sign-up fee for free users: <strong>Ksh 50</strong>. (Demo: no real charge)
            </span>
          )}
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating Account...' : 'Sign up'}
        </Button>
      </Form>
    </div>
  );
}
