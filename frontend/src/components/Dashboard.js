import React, { useEffect, useState } from 'react';
import API from '../utils/api';
import { Card, Button, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [title, setTitle] = useState('');

  async function load() {
    const r = await API.get('/chat/rooms');
    setRooms(r.data);
  }

  useEffect(()=>{ load(); }, []);

  async function createRoom() {
    if (!title) return;
    await API.post('/chat/rooms', { title });
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
        <div className="mt-3">Premium: Ksh 300 / month — gives access to AI consultant and premium chat features.</div>
      </Card>

      <Row xs={1} md={2} className="g-3">
        {rooms.map(r => (
          <Col key={r._id}>
            <Card className="p-3">
              <h5>{r.title}</h5>
              <div className="d-flex justify-content-between mt-2">
                <Link to={`/room/${r._id}`} className="btn btn-primary">Open</Link>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}
