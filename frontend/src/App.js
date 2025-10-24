import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import ChatRoom from './components/ChatRoom';
import AuthPage from './AuthPage';
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
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/room/:id" element={<ChatRoom />} />
        </Routes>
      </Container>
    </BrowserRouter>
  );
}

export default App;