import React from 'react';
import API from '../utils/api';
import { Button } from 'react-bootstrap';

export default function PremiumActions({ user }) { // Pass the whole user object
  async function payWithIntasend() {
    try {
      const token = localStorage.getItem('token');
      console.log('Token from localStorage:', token);
      if (!token) {
        return alert('Please log in to make a payment.');
      }
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      console.log('Request config:', config);
      const res = await API.post('/payments/intasend/init', {
        amount: 300,
        purpose: 'premium-renewal',
        email: user.email, // Pass user's email
      }, config);
      if (res.data.redirectUrl) {
        window.location.href = res.data.redirectUrl;
      }
    } catch (error) {
      console.error('IntaSend initiation failed', error);
      alert(error.response?.data?.message || 'Could not initiate payment.');
    }
  }

  return (
    <Button onClick={payWithIntasend}>Upgrade to Premium (Ksh 300)</Button>
  );
}
