import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Spinner, Alert } from 'react-bootstrap';
import API from '../utils/api';

export default function PaymentSuccess() {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const paymentId = query.get('paymentId');
    const userId = query.get('userId');

    if (!paymentId || !userId) {
      setError('Invalid payment confirmation URL. Please try again.');
      setStatus('error');
      return;
    }

    async function capturePayment() {
      try {
        const res = await API.post('/payments/paypal/capture-order', {
          paymentId,
          userId,
        });
        localStorage.setItem('token', res.data.token);
        setStatus('success');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to capture payment. Please contact support.');
        setStatus('error');
      }
    }

    capturePayment();
  }, [location]);

  useEffect(() => {
    if (status === 'success') {
      setTimeout(() => navigate('/dashboard'), 3000);
    }
  }, [status, navigate]);

  return (
    <Container className="text-center mt-5">
      {status === 'processing' && (
        <div>
          <h4>Processing your payment...</h4>
          <Spinner animation="border" />
        </div>
      )}
      {status === 'error' && <Alert variant="danger">{error}</Alert>}
      {status === 'success' && (
        <Alert variant="success">
          <h2>Payment successful!</h2>
          <p>You will be redirected to the dashboard automatically.</p>
        </Alert>
      )}
    </Container>
  );
}