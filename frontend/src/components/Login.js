import React, { useState } from 'react';
import API from '../utils/api';
import { Form, Button, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [msg,setMsg] = useState('');
  const nav = useNavigate();

  async function handle(e) {
    e.preventDefault();
    try {
      const r = await API.post('/auth/login', { email, password });
      localStorage.setItem('token', r.data.token);
      nav('/dashboard');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Login failed');
    }
  }

  return (
    <Card className="p-3">
      <h3>Login</h3>
      <Form onSubmit={handle}>
        <Form.Group className="mb-2">
          <Form.Label>Email</Form.Label>
          <Form.Control value={email} onChange={e=>setEmail(e.target.value)} />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Password</Form.Label>
          <Form.Control type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </Form.Group>
        <Button type="submit">Login</Button>
        {msg && <div className="mt-2 text-danger">{msg}</div>}
      </Form>
    </Card>
  );
}
