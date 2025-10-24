import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import ChatRoom from './components/ChatRoom';
import { Container, Navbar } from 'react-bootstrap';

function App() {
  return (
    <BrowserRouter>
      <Navbar bg="dark" variant="dark" className="mb-3">
        <Container>
          <Navbar.Brand>Anchor</Navbar.Brand>
        </Container>
      </Navbar>
      <Container>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/room/:id" element={<ChatRoom />} />
        </Routes>
      </Container>
    </BrowserRouter>
  );
}

export default App;