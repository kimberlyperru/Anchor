import React, { useState } from 'react';
import API from '../utils/api';
import { Form, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [error,setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await API.post('/auth/login', { email, password });
      localStorage.setItem('token', r.data.token); // Note: in a real app, you might use httpOnly cookies
      nav('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-3">
      <h3>Login</h3>
      <Form onSubmit={handleLogin}>
        <Form.Group className="mb-2">
          <Form.Label>Email</Form.Label>
          <Form.Control value={email} onChange={e=>{ setEmail(e.target.value); setError(''); }} required isInvalid={!!error} />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Password</Form.Label>
          <Form.Control type="password" value={password} onChange={e=>{ setPassword(e.target.value); setError(''); }} required isInvalid={!!error} />
          {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
        </Form.Group>
        <Button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </Form>
    </div>
  );
}
