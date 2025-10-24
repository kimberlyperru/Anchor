import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Button, Container } from 'react-bootstrap';
import API from '../utils/api';
import { useNavigate } from 'react-router-dom';

export default function AiConsultant() {
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const nav = useNavigate();
  const bottomRef = useRef(null);

  useEffect(() => {
    async function checkUser() {
      const token = localStorage.getItem('token');
      if (!token) {
        nav('/auth');
        return;
      }
      try {
        const res = await API.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.data.isPremium) {
          nav('/dashboard'); // Redirect non-premium users
        } else {
          console.log('User is premium:', res.data.isPremium);
          setConversation([{ role: 'assistant', content: 'Hello! As a premium user, you have exclusive access to my consultation services. How can I assist you today?' }]);
        }
      } catch (error) {
        console.error('Authentication error', error);
        localStorage.removeItem('token');
        nav('/auth');
      } finally {
        setLoading(false);
      }
    }
    checkUser();
  }, [nav]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    const newConversation = [...conversation, userMessage];
    setConversation(newConversation);
    setInput('');
    setIsTyping(true);

    // Prepare the history for the API, including a system prompt.
    const apiHistory = [
      { role: 'system', content: 'You are a helpful AI consultant.' },
      ...newConversation
    ];

    try {
      const token = localStorage.getItem('token');
      const res = await API.post('/ai/chat', { history: apiHistory }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const aiMessage = { role: 'assistant', content: res.data.reply };
      setConversation(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error getting AI response", error);
      const errorMessage = { role: 'assistant', content: "Sorry, I'm having trouble connecting right now." };
      setConversation(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  }

  if (loading) {
    return <Container><p>Verifying premium access...</p></Container>;
  }

  return (
    <Container>
      <Card>
        <Card.Header as="h4">AI Consultant</Card.Header>
        <Card.Body style={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', padding: '10px' }}>
            {conversation.map((msg, index) => (
              <div key={index} className={`p-2 my-2 rounded ${msg.role === 'assistant' ? 'bg-light text-dark' : 'bg-primary text-white ms-auto'}`} style={{ maxWidth: '75%' }}>
                <strong>{msg.role === 'assistant' ? 'AI' : 'You'}:</strong> {msg.content}
              </div>
            ))}
            {isTyping && <div className="p-2 my-2 rounded bg-light text-dark" style={{ maxWidth: '75%' }}><strong>AI:</strong> Typing...</div>}
            <div ref={bottomRef} />
          </div>
          <Form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <div className="d-flex">
              <Form.Control
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the AI consultant anything..."
                disabled={isTyping}
              />
              <Button type="submit" className="ms-2" disabled={isTyping}>Send</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}