import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../utils/api';
import io from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';
import { Card, Button, Form, Badge } from 'react-bootstrap';
import avatarImages from '../utils/avatars';

export default function ChatRoom() {
  const { id } = useParams();
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const bottomRef = useRef();

  useEffect(() => {
    // ✅ Initialize socket connection
    const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000', {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket'], // ensures compatibility
    });
    setSocket(newSocket);

    // ✅ Use newSocket directly (not socket) to avoid null reference
    newSocket.emit('joinRoom', { roomId: id });

    // ✅ Fetch chat history
    API.get(`/chat/rooms/${id}/messages`).then(r => setMessages(r.data || []));

    // ✅ Decode user token
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser(decoded);
      } catch (err) {
        console.error('Invalid token', err);
      }
    }

    // ✅ Listen for new messages
    newSocket.on('message', (msg) => {
      if (msg.chatId === id) setMessages(prev => [...prev, msg]);
    });

    // ✅ Listen for deleted messages
    newSocket.on('messageDeleted', ({ messageId }) => {
      setMessages(prev => prev.filter(m => (m._id || m.id) !== messageId));
    });

    // ✅ Cleanup on unmount
    return () => {
      newSocket.emit('leaveRoom', { roomId: id });
      newSocket.off('message');
      newSocket.off('messageDeleted');
      newSocket.disconnect();
    };
  }, [id, token]);

  // ✅ Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ✅ Safe send function
  async function send() {
    if (!socket || !text.trim()) return;

    try {
      const filtered = await API.post('/mod/filter', { text }).then(r => r.data.cleaned || text);
      socket.emit('message', { token, roomId: id, content: filtered, parentId: null });
      setText('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }

  // ✅ Safe delete function
  async function deleteMessage(messageId) {
    if (!socket) return;
    if (window.confirm('Are you sure you want to delete this post?')) {
      if (token && messageId) {
        socket.emit('deleteMessage', { token, messageId, roomId: id });
      }
    }
  }

  return (
    <Card className="p-3">
      <div className="d-flex justify-content-between align-items-center">
        <h4>Thread</h4>
        {user?.isPremium && (
          <Link to="/main" className="btn btn-success">
            AI Consultant
          </Link>
        )}
      </div>
      <div
        style={{
          height: '60vh',
          overflowY: 'auto',
          border: '1px solid #dc9519ff',
          padding: 10,
          marginBottom: 10,
        }}
      >
        {messages.map(m => (
          <div key={m.id || m._id} style={{ padding: 8, borderBottom: '1px solid #DAA520' }}>
            <div className="d-flex">
              <div style={{ position: 'relative', marginRight: '10px', flexShrink: 0 }}>
                <img
                  src={avatarImages[m.avatar]}
                  style={{ width: 40, height: 40, borderRadius: '50%' }}
                  alt="avatar"
                />
                {m.isPremium && (
                  <Badge 
                    bg="warning" 
                    pill 
                    style={{ position: 'absolute', top: -5, right: -5, border: '2px solid white' }}
                  >
                    👑
                  </Badge>
                )}
              </div>
              <div>
                <div
                  style={{ fontSize: 14 }}
                  dangerouslySetInnerHTML={{ __html: escapeHtml(m.content) }}
                />
                <small className="text-muted">{new Date(m.createdAt).toLocaleString()}</small>
              </div>
              {user?.id === m.userId && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => deleteMessage(m.id || m._id)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Form.Control
          as="textarea"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share something anonymously..."
        />
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

// ✅ Escape HTML safely to prevent XSS
function escapeHtml(unsafe) {
  return String(unsafe || '')
    .replace(/[&<"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '"': '&quot;',
      "'": '&#039;',
    }[m]))
    .replace(/\n/g, '<br/>');
}