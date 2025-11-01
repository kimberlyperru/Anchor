import React, { useEffect, useState } from 'react';
import API from '../utils/api';
import { Card, Button, Row, Col, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import avatarImages from '../utils/avatars';
import PremiumActions from './PremiumActions'; 
import { useUser } from '../context/UserContext';
import './Dashboard.css';

export default function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [title, setTitle] = useState('');
  const { user } = useUser(); // ✅ Get user from global context

  async function load() {
    try {
      const roomsRes = await API.get('/chat/rooms');
      setRooms(roomsRes.data);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
      // Handle error, maybe redirect to login if auth fails
    }
  }

  useEffect(()=>{ load(); }, []);

  async function createRoom() {
    if (!title) return;
    await API.post('/chat/rooms', { title }); // This call needs auth headers
    setTitle('');
    load();
  }

  return (
    <>
      <Card className="p-3 mb-3">
        <h4>Create new anonymous thread</h4>
        <div className="d-flex gap-2">
          <input className="form-control" placeholder="Thread title" value={title} onChange={e=>setTitle(e.target.value)} />
          <Button onClick={createRoom}>Create</Button>
        </div>
        <div className="mt-3">
          {user && user.isPremium && new Date(user.premiumUntil) > new Date()
            ? (
              <div className="d-flex align-items-center">
                <div style={{ position: 'relative', marginRight: '1rem' }}>
                  <img src={avatarImages[user.avatar]} alt="avatar" style={{ width: 50, height: 50, borderRadius: '50%' }} />
                  <Badge 
                    bg="warning" 
                    pill 
                    style={{ 
                      position: 'absolute', 
                      top: '-5px', 
                      right: '-5px',
                      fontSize: '0.75rem'
                    }}
                  >👑</Badge>
                </div>
                <span>Welcome Premium User!</span> <Link to="/main" className="btn btn-success ms-3">Access AI Consultant</Link>
              </div>
            )
            : (
              <div className="d-flex align-items-center">
                <div style={{ position: 'relative', marginRight: '1rem' }}>
                  <img src={avatarImages[user.avatar]} alt="avatar" style={{ width: 50, height: 50, borderRadius: '50%' }} />
                </div>
                <span>Welcome Free User!</span>
              </div>
            )
          }
          {user && user.isAdmin && (
            <div className="mt-3">
              <Link to="/admin" className="btn btn-info">Admin Panel</Link>
            </div>
          )}
        </div>
      </Card>

      <Row xs={1} md={2} className="g-3">
        {rooms.map(r => (
          <Col key={r._id}>
            <Card className="p-3">
              <h5>{r.title}</h5>
              <div className="text-muted small">
                {r.messageCount || 0} messages · Created {new Date(r.createdAt).toLocaleDateString()}
              </div>
              <div className="d-flex justify-content-between mt-2">
                <Link to={`/main`} className="btn btn-primary">Open</Link>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}
