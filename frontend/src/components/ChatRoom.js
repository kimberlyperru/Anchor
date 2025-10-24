import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import API from '../utils/api';
import io from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';
import { Card, Button, Form } from 'react-bootstrap';
import avatarImages from '../utils/avatars';

const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000');

export default function ChatRoom() {
  const { id } = useParams();
  const [messages, setMessages] = useState([]);
  const [text,setText] = useState('');
  const [user,setUser] = useState(null);
  const [token,setToken] = useState(localStorage.getItem('token'));
  const bottomRef = useRef();

  useEffect(()=> {
    socket.emit('joinRoom', { roomId: id });
    API.get(`/chat/rooms/${id}/messages`).then(r => setMessages(r.data || []));

    if (token) {
      const decoded = jwtDecode(token);
      setUser(decoded)
    }

    socket.on('message', (msg) => {
      if (msg.chatId === id) setMessages(prev => [...prev, msg]);
    });

    socket.on('messageDeleted', ({ messageId }) => {
      setMessages(prev => prev.filter(m => (m._id || m.id) !== messageId));
    });

    return () => {
      socket.emit('leaveRoom', { roomId: id });
      socket.off('message');
      socket.off('messageDeleted');
    }
  }, [id]);

  async function deleteMessage(messageId) {
    if (window.confirm('Are you sure you want to delete this post?')) {
      if (token && messageId) {
        socket.emit('deleteMessage', { token, messageId, roomId: id });
      }
    }
  }

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
      <div style={{height: '60vh', overflowY: 'auto', border: '1px solid #0F52BA', padding: 10, marginBottom: 10}}>
        {messages.map(m => (
          <div key={m.id || m._id} style={{padding:8, borderBottom:'1px solid #DAA520'}}>
            <div className="d-flex align-items-center" >
              <img src={avatarImages[m.avatar]} style={{width:40,height:40,marginRight:10}} alt="avatar" />
              <div>
                <div style={{fontSize:14}} dangerouslySetInnerHTML={{__html: escapeHtml(m.content)}} />
                <small className="text-muted">{new Date(m.createdAt).toLocaleString()}</small>
              </div>
              {user?.id === m.userId && (
                <Button variant="danger" size="sm" onClick={() => deleteMessage(m.id || m._id)}>Delete</Button>
              )}
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
  return String(unsafe || '')
    .replace(/[&<"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '"': '&quot;', "'": '&#039;' }[m]))
    .replace(/\n/g, '<br/>');
}
