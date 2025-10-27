import React, { useState } from 'react';
import API from '../utils/api';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import avatarImages from '../utils/avatars';

const avatars = ['fox','bear','owl','lion','tiger','panda','wolf','elephant','dog','cat'];

export default function Signup() {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [avatar,setAvatar] = useState('fox');
  const [error,setError] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const nav = useNavigate();

  // This state will hold the details needed for payment after signup
  const [paymentDetails, setPaymentDetails] = useState(null);

  async function handleSignup(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await API.post('/auth/signup', { email, password, avatar, isPremium });
      // If signup requires payment, store details and move to payment step.
      if (response.data.paymentDetails) {
        // We also need the token to make authenticated API calls for payment
        localStorage.setItem('token', response.data.token);
        setPaymentDetails({ ...response.data.paymentDetails, email });
      } else {
        // If no payment is needed (e.g., free user), log them in directly.
        localStorage.setItem('token', response.data.token);
        nav('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }
  
  // This function handles the payment step after signup is complete.
  const handlePayment = async () => {
  setError('');
  setLoading(true);

  try {
    const { amount, purpose, email } = paymentDetails;

    // ✅ Retrieve token from localStorage
    const token = localStorage.getItem('token');

    // ✅ Send token in Authorization header
    const res = await API.post(
      '/payments/intasend/init',
      { amount, purpose, email },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // ✅ Updated key name (based on your backend response)
    if (res.data.checkout_url) {
      window.location.href = res.data.checkout_url;
    } else {
      throw new Error('Missing checkout URL from backend.');
    }
  } catch (err) {
    console.error('Payment error:', err.response?.data || err.message);
    setError(err.response?.data?.message || 'An error occurred during payment.');
  } finally {
    setLoading(false);
  }
};

  // If we have paymentDetails, we show the payment UI instead of the signup form.
  if (paymentDetails) {
    return (
      <Card className="p-3">
        <Card.Body>
          <Card.Title>Complete Your Signup</Card.Title>
          <Card.Text>Your account is created. Please complete the payment of <strong>Ksh {paymentDetails.amount}</strong> to activate your premium features.</Card.Text>
          {error && <Alert variant="danger">{error}</Alert>}
          <Button onClick={handlePayment} disabled={isLoading}>
            {isLoading ? 'Processing...' : `Pay Ksh ${paymentDetails.amount} with IntaSend`}
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
          <Form.Control value={email} onChange={e=>{ setEmail(e.target.value); setError(''); }} required isInvalid={!!error} />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Password</Form.Label>
          <Form.Control type="password" value={password} onChange={e=>{ setPassword(e.target.value); setError(''); }} required isInvalid={!!error} />
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
              <div key={a} onClick={()=>setAvatar(a)} className={`avatar-select ${avatar === a ? 'selected' : ''}`}>
                <img src={avatarImages[a]} alt={a} />
                <div>{a}</div>
              </div>
            ))}
          </div>
        </Form.Group>

        <div className="mb-3">
          {isPremium
            ? <span>Premium subscription: <strong>Ksh 300 / month</strong>. (Demo: no real charge)</span>
            : <span>Sign-up fee for free users: <strong>Ksh 50</strong>. (Demo: no real charge)</span>
          }
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating Account...' : 'Sign up'}
        </Button>
      </Form>
    </div>
  );
}
