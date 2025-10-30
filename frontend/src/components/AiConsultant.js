import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Button, Container, Alert, Spinner } from 'react-bootstrap';
import API from '../utils/api';
import { useNavigate } from 'react-router-dom';

export default function AiConsultant() {
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [error, setError] = useState('');
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
        // PremiumRoute handles access, so we just set the initial message.
        setConversation([{ role: 'assistant', content: 'Hello! As a premium user, you have exclusive access to my consultation services. How can I assist you today?' }]);
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

  async function handleCopy(text, index) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000); // "Copied!" message disappears after 2s
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input.trim() };
    const currentConversation = [...conversation, userMessage];
    // Add user message and an empty assistant message for the stream placeholder
    setConversation([...currentConversation, { role: 'assistant', content: '' }]);
    setInput('');
    setIsTyping(true);
    setError('');

    // Prepare the history for the API. The backend handles the system prompt.
    const apiHistory = [
      { role: 'system', content: 'You are a helpful AI consultant.' },
      ...currentConversation
    ];

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API.defaults.baseURL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ history: apiHistory })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to fetch stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

        for (const line of lines) {
          const jsonStr = line.replace('data: ', '');
          const data = JSON.parse(jsonStr);
          if (data.reply) {
            setConversation(prev => {
              const lastMsg = prev[prev.length - 1];
              lastMsg.content += data.reply;
              return [...prev.slice(0, -1), lastMsg];
            });
          }
        }
      }
    } catch (error) {
      console.error("Error getting AI response", error);
      setError(error.message || "Sorry, I'm having trouble connecting right now.");
      // On error, revert the conversation to its state before the user's message was added.
      setConversation(currentConversation);
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
              <div key={index} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div className={`p-2 my-2 rounded ${msg.role === 'assistant' ? 'bg-light text-dark' : 'bg-primary text-white'}`} style={{ maxWidth: '75%' }}>
                  <strong>{msg.role === 'assistant' ? 'AI' : 'You'}:</strong> {msg.content}
                  {msg.role === 'assistant' && msg.content && (
                    <div className="text-end mt-2">
                      <Button variant="outline-secondary" size="sm" onClick={() => handleCopy(msg.content, index)}>
                        {copiedIndex === index ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="p-2 my-2 rounded bg-light text-dark" style={{ maxWidth: '75%', alignSelf: 'flex-start' }}>
                <strong>AI:</strong> <Spinner animation="grow" size="sm" className="me-1" />Typing...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <Form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <div className="d-flex">
              <Form.Control
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
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