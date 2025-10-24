import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import ChatRoom from './components/ChatRoom';
import AuthPage from './AuthPage';
import AiConsultant from './components/AiConsultant';
import { Container, Navbar, Button, Nav } from 'react-bootstrap';

function App() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/auth');
    // We might want to force a re-render or reload to update state across the app
    window.location.reload();
  };

  return (
    <>
      <Navbar bg="dark" variant="dark" className="mb-3">
        <Container fluid>
          <Navbar.Brand>Anchor</Navbar.Brand>
          <Nav className="ms-auto">
            {token && <Button variant="outline-light" onClick={handleLogout}>Log Out</Button>}
          </Nav>
        </Container>
      </Navbar>
      <Container>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/room/:id" element={<ChatRoom />} />
          <Route path="/consultant" element={<AiConsultant />} />
        </Routes>
      </Container>
    </>
  );
}

export default App;