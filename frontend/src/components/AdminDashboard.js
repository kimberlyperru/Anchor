import React, { useEffect, useState } from 'react';
import { Container, Table, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import API from '../utils/api';
import './AdminDashboard.css'; // Import the new CSS file

export default function AdminDashboard() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth');
      return;
    }

    try {
      const user = jwtDecode(token);
      if (!user.isAdmin) {
        navigate('/dashboard'); // Redirect non-admins
        return;
      }
    } catch (error) {
      setError('Invalid token. Please log in again.');
      navigate('/auth');
      return;
    }

    async function fetchTransactions() {
      try {
        const res = await API.get('/payments/admin/transactions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTransactions(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch transactions.');
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();
  }, [navigate]);

  const getStatusBadge = (status) => {
    let statusClass = '';
    let text = status.charAt(0).toUpperCase() + status.slice(1);

    switch (status) {
      case 'success':
        statusClass = 'status-success';
        break;
      case 'failed':
        statusClass = 'status-failed';
        break;
      case 'pending':
        statusClass = 'status-pending';
        break;
      default:
        statusClass = 'status-success'; // Default to success style
    }
    // Using a span with custom classes instead of Bootstrap's Badge to avoid style conflicts
    return <span className={`status-badge ${statusClass}`}>{text}</span>;
  };

  if (loading) {
    return <Container className="text-center mt-5"><Spinner animation="border" /></Container>;
  }

  return (
    <Container fluid className="admin-dashboard-container">
      <h2 className="my-4">Admin Dashboard - Transactions</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      <Table striped bordered hover responsive>
        <thead className="table-header-custom">
          <tr>
            <th>Date</th>
            <th>User</th>
            <th>Provider</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx._id}>
              <td>{new Date(tx.createdAt).toLocaleString()}</td>
              <td>{tx.userId?.email || 'N/A'}</td>
              <td>{tx.provider}</td>
              <td>Ksh {tx.amount}</td>
              <td>{getStatusBadge(tx.status)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Container>
  );
}