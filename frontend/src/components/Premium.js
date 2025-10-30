import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';

const Premium = () => {
  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>Welcome to Premium!</h1>
      <p>Enjoy your exclusive content.</p>
      <Link to="/consultant">
        <Button variant="primary">AI Consultant</Button>
      </Link>
    </div>
  );
};

export default Premium;
