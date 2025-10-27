import React from 'react';
import { Container, Alert, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function PaymentCancel() {
  return (
    <Container className="text-center mt-5">
      <Alert variant="warning">
        <h4>Payment Canceled</h4>
        <p>
          Your payment process was canceled. You can go back and try again.
        </p>
        <Button as={Link} to="/auth" variant="primary">Back to Signup</Button>
      </Alert>
    </Container>
  );
}