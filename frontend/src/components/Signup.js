import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import avatarImages from '../utils/avatars';
import { useUser } from '../context/UserContext';

const avatars = ['fox', 'bear', 'owl', 'lion', 'tiger', 'panda', 'wolf', 'elephant', 'dog', 'cat'];

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('fox');
  const [error, setError] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [paymentDetails, setPaymentDetails] = useState(null);

  const nav = useNavigate();
  const { login } = useUser();

  // ✅ Poll backend after payment initiation
  useEffect(() => {
    if (!paymentDetails?.isPolling) return;
    let intervalId, timeoutId;

    const startPolling = () => {
      intervalId = setInterval(async () => {
        try {
          const response = await API.get(`/auth/me-unactivated/${paymentDetails.userId}`);
          if (response.data?.isActive) {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
            await login(paymentDetails.email, paymentDetails.password);
            nav('/dashboard');
          }
        } catch (err) {
          if (err.response?.status === 404) {
            console.log('User not yet activated — retrying...');
          } else {
            console.error('Polling error:', err);
            setError('Error checking payment status. Please refresh and try again.');
            setLoading(false);
            clearInterval(intervalId);
            clearTimeout(timeoutId);
          }
        }
      }, 5000);

      timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        setError('Payment confirmation timed out. Please try again.');
        setLoading(false);
      }, 60000);
    };

    startPolling();
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [paymentDetails, nav, login]);

  // ✅ Signup handler
  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await API.post('/auth/signup', {
        email,
        password,
        avatar,
        isPremium,
      });

      if (response.data.paymentDetails) {
        setPaymentDetails({
          ...response.data.paymentDetails,
          email,
          password,
        });
      } else if (response.data.token) {
        login(response.data.token, response.data.user);
        nav('/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  // ✅ M-Pesa payment handler
  const handlePayment = async () => {
    setError('');
    setLoading(true);

    if (!/^254\d{9}$/.test(phone)) {
      setError('Please enter a valid phone number (format: 254xxxxxxxxx).');
      setLoading(false);
      return;
    }

    try {
      const config = {
        headers: { Authorization: `Bearer ${paymentDetails.token}` },
      };

      // ✅ send `phone` instead of `phoneNumber`
      const res = await API.post(
        '/mpesa/init',
        {
          amount: paymentDetails.amount,
          phoneNumber: phone,
        },
        config
      );

      alert(res.data.message || 'STK Push initiated. Enter your M-Pesa PIN to complete payment.');
      setPaymentDetails((prev) => ({ ...prev, isPolling: true }));
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.response?.data?.message || 'Payment initiation failed.');
      setLoading(false);
    }
  };

  // ✅ Render while waiting for payment confirmation
  if (paymentDetails?.isPolling) {
    return (
      <Card className="p-3 text-center">
        <Card.Body>
          <Card.Title>Awaiting Payment Confirmation</Card.Title>
          <Card.Text>
            Please complete the M-Pesa payment on your phone. This page will update automatically.
          </Card.Text>
          {isLoading && (
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          )}
          {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
        </Card.Body>
      </Card>
    );
  }

  // ✅ Render payment step after signup
  if (paymentDetails) {
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
              onChange={(e) => setPhone(e.target.value)}
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

  // ✅ Render signup form
  return (
    <div className="p-3">
      <h3>Sign up</h3>
      <Form onSubmit={handleSignup}>
        <Form.Group className="mb-2">
          <Form.Label>Email</Form.Label>
          <Form.Control
            value={email}
            onChange={(e) => {
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
            onChange={(e) => {
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
            {avatars.map((a) => (
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
            <span>Premium subscription: <strong>Ksh 300 / month</strong>.</span>
          ) : (
            <span>Sign-up fee for free users: <strong>Ksh 50</strong>.</span>
          )}
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating Account...' : 'Sign up'}
        </Button>
      </Form>
    </div>
  );
}
