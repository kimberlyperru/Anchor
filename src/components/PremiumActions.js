import React from 'react';
import API from '../utils/api';
import { Button } from 'react-bootstrap';

export default function PremiumActions({ userId }) {
  async function payWithMpesa() {
    const res = await API.post('/payments/intasend/init', { amount: 300, email: 'demo@example.com', purpose: 'premium' });
    alert(res.data.message + '\nPaymentId: ' + res.data.paymentId);
    // In production, you'd wait for callback/webhook then refresh user status
  }

  async function payWithPaypal() {
    const res = await API.post('/payments/paypal/create-order', { amount: 300, purpose: 'premium' });
    window.open(res.data.approvalUrl, '_blank');
    alert('Opened PayPal sandbox approval page (demo). After approval call capture endpoint from your server.');
  }

  return (
    <div className="d-flex gap-2">
      <Button onClick={payWithMpesa}>Pay Ksh 300 (M-Pesa demo)</Button>
      <Button onClick={payWithPaypal}>Pay with PayPal (demo)</Button>
    </div>
  );
}
