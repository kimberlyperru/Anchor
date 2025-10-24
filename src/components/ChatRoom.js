import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import API from '../utils/api';
import io from 'socket.io-client';
import { Card, Button, Form } from 'react-bootstrap';

const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000');

export default function ChatRoom() {
  const { id } = useParams();
  const [messages, setMessages] = useState([]);
  const [text,setText] = useState('');
  const [token,setToken] = useState(localStorage.getItem('token'));
  const bottomRef = useRef();

  useEffect(()=> {
    socket.emit('joinRoom', { roomId: id });
    API.get(`/chat/rooms/${id}/messages`).then(r => setMessages(r.data || []));

    socket.on('message', (msg) => {
      if (msg.chatId === id) setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.emit('leaveRoom', { roomId: id });
      socket.off('message');
    }
  }, [id]);

  useEffect(()=> bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  async function send() {
    if (!text.trim()) return;
    // optional: call moderation filter endpoint first
    const filtered = await API.post('/mod/filter', { text }).then(r => r.data.cleaned);
    socket.emit('message', { token, roomId: id, content: filtered, parentId: null });
    setText('');
  }

  return (
    <Card className="p-3">
      <h4>Thread</h4>
      <div style={{height: '60vh', overflowY: 'auto', border: '1px solid #eee', padding: 10, marginBottom: 10}}>
        {messages.map(m => (
          <div key={m.id || m._id} style={{padding:8, borderBottom:'1px solid #f0f0f0'}}>
            <div className="d-flex align-items-center">
              <img src={`/avatars/${m.avatar}.gif`} style={{width:40,height:40,marginRight:10}} alt="a"/>
              <div>
                <div style={{fontSize:14}} dangerouslySetInnerHTML={{__html: escapeHtml(m.content)}} />
                <small className="text-muted">{new Date(m.createdAt).toLocaleString()}</small>
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <Form onSubmit={(e)=>{ e.preventDefault(); send(); }}>
        <Form.Control as="textarea" rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder="Share something anonymously..." />
        <div className="d-flex justify-content-between mt-2">
          <div>
            <small className="text-muted">Be respectful — no explicit content or abuse.</small>
          </div>
          <Button onClick={send}>Send</Button>
        </div>
      </Form>
    </Card>
  );
}

function escapeHtml(unsafe) {
  return (unsafe || '').replace(/[&<"']/g, function(m) {
    return ({'&':'&amp;','<':'&lt;','"':'&quot;',"'":'&#039;'})[m];
  }).replace(/\n/g, '<br/>');
}
