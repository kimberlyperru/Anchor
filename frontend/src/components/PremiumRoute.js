import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import API from '../utils/api';
import { Spinner } from 'react-bootstrap';

export default function PremiumRoute({ children }) {
  const [authStatus, setAuthStatus] = useState({ loading: true, isPremium: false });
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    async function checkUser() {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setAuthStatus({ loading: false, isPremium: false });
          return;
        }
        const res = await API.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAuthStatus({ loading: false, isPremium: res.data.isPremium });
      } catch (error) {
        console.error('Failed to fetch user data', error);
        // Handle expired/invalid token
        localStorage.removeItem('token');
        setAuthStatus({ loading: false, isPremium: false });
      } finally {
        setLoading(false);
      }
    }
    checkUser();
  }, []);

  if (authStatus.loading) {
    return <Spinner animation="border" />;
  }

  if (authStatus.isPremium) {
    return children;
  }

  // Redirect to login, but save the intended location
  return <Navigate to="/auth" state={{ from: location }} replace />;
}