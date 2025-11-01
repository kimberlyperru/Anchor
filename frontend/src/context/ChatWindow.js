import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useUser } from '../context/UserContext';
import { Form, Button, InputGroup, ListGroup, Spinner } from 'react-bootstrap';

const TYPING_TIMER_LENGTH = 1500; // 1.5 seconds

// Assume conversationId is passed as a prop, identifying the chat room
export default function ChatWindow({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  
  const socket = useSocket();
  const { user } = useUser();
  const typingTimeoutRef = useRef(null);

  // Effect for handling incoming socket events
  useEffect(() => {
    if (!socket) return;

    // Join the specific chat room upon connection
    socket.emit('joinRoom', conversationId);

    const handleNewMessage = (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    const handleUserTyping = ({ username }) => {
      setTypingUsers((users) => {
        if (!users.includes(username)) {
          return [...users, username];
        }
        return users;
      });
    };

    const handleUserStoppedTyping = ({ username }) => {
      setTypingUsers((users) => users.filter((u) => u !== username));
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('userIsTyping', handleUserTyping);
    socket.on('userStoppedTyping', handleUserStoppedTyping);

    // Clean up listeners and leave the room when the component unmounts
    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('userIsTyping', handleUserTyping);
      socket.off('userStoppedTyping', handleUserStoppedTyping);
      socket.emit('leaveRoom', conversationId);
    };
  }, [socket, conversationId]);

  const handleTyping = () => {
    if (!socket) return;

    // Emit 'startTyping' only once
    if (!typingTimeoutRef.current) {
      socket.emit('startTyping', { room: conversationId });
    }

    // Clear the previous timeout
    clearTimeout(typingTimeoutRef.current);

    // Set a new timeout to emit 'stopTyping' after the user pauses
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { room: conversationId });
      typingTimeoutRef.current = null;
    }, TYPING_TIMER_LENGTH);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!socket || !newMessage.trim()) return;

    const messageData = {
      room: conversationId,
      text: newMessage,
      sender: user.username,
    };

    socket.emit('sendMessage', messageData);
    
    // Also notify that typing has stopped
    clearTimeout(typingTimeoutRef.current);
    socket.emit('stopTyping', { room: conversationId });
    typingTimeoutRef.current = null;

    setNewMessage('');
  };

  return (
    <div className="d-flex flex-column h-100 p-3">
      <ListGroup className="flex-grow-1 mb-3" style={{ overflowY: 'auto' }}>
        {messages.map((msg, index) => (
          <ListGroup.Item key={index}>
            <strong>{msg.sender}:</strong> {msg.text}
          </ListGroup.Item>
        ))}
      </ListGroup>
      <div className="typing-indicator" style={{ height: '24px', fontStyle: 'italic' }}>
        {typingUsers.length > 0 && (
          <>{`${typingUsers.join(', ')} ${typingUsers.length > 1 ? 'are' : 'is'} typing...`}<Spinner animation="grow" size="sm" /></>
        )}
      </div>
      <Form onSubmit={handleSendMessage}>
        <InputGroup>
          <Form.Control type="text" placeholder="Type a message..." value={newMessage} onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }} />
          <Button type="submit" variant="primary">Send</Button>
        </InputGroup>
      </Form>
    </div>
  );
}