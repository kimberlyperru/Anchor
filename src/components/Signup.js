import React, { useState } from 'react';
import API from '../utils/api';
import { Form, Button, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const avatars = ['fox','bear','owl','lion','tiger','panda','wolf','elephant','dog','cat'];

export default function Signup() {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [avatar,setAvatar] = useState('fox');
  const [msg,setMsg] = useState('');
  const nav = useNavigate();

  async function handleSignup(e) {
    e.preventDefault();
    try {
      const res = await API.post('/auth/signup', { email, password, avatar });
      // backend returns a token; in production require paying the signup fee before granting access. For demo we store token.
      localStorage.setItem('token', res.data.token);
      nav('/dashboard');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Signup failed');
    }
  }

  return (
    <Card className="p-3">
      <h3>Sign up</h3>
      <Form onSubmit={handleSignup}>
        <Form.Group className="mb-2">
          <Form.Label>Email</Form.Label>
          <Form.Control value={email} onChange={e=>setEmail(e.target.value)} required />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Password</Form.Label>
          <Form.Control type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Pick an avatar (anonymous)</Form.Label>
          <div className="d-flex gap-2 flex-wrap">
            {avatars.map(a => (
              <div key={a} onClick={()=>setAvatar(a)} style={{cursor:'pointer', textAlign:'center', width:80, padding:6, border: avatar===a ? '2px solid #0d6efd' : '1px solid #ddd', borderRadius:8}}>
                <img src={`/avatars/${a}.gif`} alt={a} style={{width:60, height:60}}/>
                <div style={{fontSize:12}}>{a}</div>
              </div>
            ))}
          </div>
        </Form.Group>

        <div className="mb-3">Sign-up fee for free users: <strong>Ksh 50</strong>. (Demo: no real charge)</div>

        <Button type="submit">Sign up</Button>
        {msg && <div className="mt-2 text-danger">{msg}</div>}
      </Form>
    </Card>
  );
}
