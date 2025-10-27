import React from 'react';
import { Card, Container, Tabs, Tab } from 'react-bootstrap';
import Login from './components/Login';
import Signup from './components/Signup';
import './components/Dashboard.css';

export default function AuthPage() {
  return (
    <Container style={{ maxWidth: '500px' }}>
      <Card>
        <Card.Body>
          <Tabs defaultActiveKey="login" id="auth-tabs" className="mb-3" fill>
            <Tab eventKey="login" title="Login"><Login /></Tab>
            <Tab eventKey="signup" title="Sign Up"><Signup /></Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </Container>
  );
}