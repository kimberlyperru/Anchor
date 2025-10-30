 import React, { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { Table, Button, Container, Row, Col, Card, Tab, Nav, Form, InputGroup, Modal, Alert, Pagination } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [userFilter, setUserFilter] = useState('');
  const [userSortConfig, setUserSortConfig] = useState({ key: 'createdAt', direction: 'descending' });
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // State for the edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editError, setEditError] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const params = {
        page: currentPage,
        limit: 10,
        filter: userFilter,
        sortKey: userSortConfig.key,
        sortDirection: userSortConfig.direction,
      };
      const res = await API.get('/admin/users', { params });
      setUsers(res.data.users);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error('Failed to load users', error);
    }
  }, [currentPage, userFilter, userSortConfig]);

  const loadRooms = async () => {
    try {
      const roomsRes = await API.get('/chat/rooms');
      setRooms(roomsRes.data);
    } catch (error) {
      console.error('Failed to load rooms', error);
    }
  };

  useEffect(() => {
    loadUsers();
    loadRooms(); // Load rooms once on initial mount
  }, [loadUsers]);

  const deleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      await API.delete(`/admin/users/${userId}`);
      loadUsers(); // Refresh data
    }
  };

  const toggleUserBan = async (userId, isCurrentlyBanned) => {
    const action = isCurrentlyBanned ? 'unban' : 'ban';
    const confirmationMessage = `Are you sure you want to ${action} this user?`;

    if (window.confirm(confirmationMessage)) {
      await API.post(`/admin/users/${userId}/ban`, { ban: !isCurrentlyBanned });
      loadUsers(); // Refresh data to show the new status
    }
  };

  const handleShowEditModal = (user) => {
    // Format date for the input[type=date] field
    const formattedUser = {
      ...user,
      premiumUntil: user.premiumUntil ? new Date(user.premiumUntil).toISOString().split('T')[0] : ''
    };
    setEditingUser(formattedUser);
    setShowEditModal(true);
    setEditError('');
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
  };

  const handleSaveChanges = async () => {
    if (!editingUser) return;
    try {
      await API.put(`/admin/users/${editingUser._id}`, {
        isPremium: editingUser.isPremium,
        premiumUntil: editingUser.premiumUntil || null, // Send null if date is cleared
        isAdmin: editingUser.isAdmin,
      });
      handleCloseEditModal();
      loadUsers(); // Refresh the user list
    } catch (error) {
      console.error('Failed to update user', error);
      setEditError(error.response?.data?.message || 'Failed to save changes.');
    }
  };

  const deleteRoom = async (roomId) => {
    if (window.confirm('Are you sure you want to delete this room and all its messages?')) {
      await API.delete(`/admin/rooms/${roomId}`);
      loadRooms(); // Refresh data
    }
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (userSortConfig.key === key && userSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setCurrentPage(1); // Reset to first page on sort
    setUserSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (userSortConfig.key !== key) return null;
    return userSortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };

  const handleFilterChange = (e) => {
    setUserFilter(e.target.value);
    setCurrentPage(1); // Reset to first page on filter change
  };

  const UserTable = ({ users, onSort, getSortIndicator, onToggleBan, onEdit, onDelete }) => (
    <Table striped bordered hover responsive>
      <thead>
        <tr>
          <th onClick={() => onSort('email')} style={{ cursor: 'pointer' }}>
            Email{getSortIndicator('email')}
          </th>
          <th onClick={() => onSort('isPremium')} style={{ cursor: 'pointer' }}>
            Status{getSortIndicator('isPremium')}
          </th>
          <th onClick={() => onSort('createdAt')} style={{ cursor: 'pointer' }}>
            Joined{getSortIndicator('createdAt')}
          </th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user._id}>
            <td>{user.email}</td>
            <td>
              {user.isPremium ? <span className="badge bg-warning text-dark">Premium</span> : <span className="badge bg-secondary">Standard</span>}
              {user.isAdmin && <span className="badge bg-info text-dark ms-1">Admin</span>}
              {user.isBanned && <span className="badge bg-danger ms-1">Banned</span>}
            </td>
            <td>{new Date(user.createdAt).toLocaleDateString()}</td>
            <td>
              <Button variant="outline-primary" size="sm" className="me-2" onClick={() => onEdit(user)}>
                Edit
              </Button>
              {user.isBanned ? (
                <Button variant="success" size="sm" className="me-2" onClick={() => onToggleBan(user._id, user.isBanned)}>
                  Unban
                </Button>
              ) : (
                <Button variant="warning" size="sm" className="me-2" onClick={() => onToggleBan(user._id, user.isBanned)}>
                  Ban
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={() => onDelete(user._id)}>Delete</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );

  return (
    <Container fluid>
      <Row>
        <Col>
          <h2 className="my-4">Admin Panel</h2>
          <Tab.Container defaultActiveKey="users">
            <Nav variant="pills" className="mb-3">
              <Nav.Item>
                <Nav.Link eventKey="users">User Management</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="rooms">Room Management</Nav.Link>
              </Nav.Item>
            </Nav>
            <Tab.Content>
              <Tab.Pane eventKey="users">
                <Card>
                  <Card.Header>Users ({users.length})</Card.Header>
                  <Card.Body>
                    <InputGroup className="mb-3">
                      <Form.Control
                        placeholder="Filter by email..."
                        value={userFilter}
                        onChange={handleFilterChange}
                      />
                    </InputGroup>
                    <UserTable
                      users={users}
                      onSort={requestSort}
                      getSortIndicator={getSortIndicator}
                      onEdit={handleShowEditModal}
                      onToggleBan={toggleUserBan}
                      onDelete={deleteUser}
                    />
                    <Pagination>
                      <Pagination.First onClick={() => setCurrentPage(1)} disabled={currentPage === 1} />
                      <Pagination.Prev onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} />
                      {[...Array(totalPages).keys()].map(pageNumber => (
                        <Pagination.Item key={pageNumber + 1} active={pageNumber + 1 === currentPage} onClick={() => setCurrentPage(pageNumber + 1)}>
                          {pageNumber + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} />
                      <Pagination.Last onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} />
                    </Pagination>
                  </Card.Body>
                </Card>
              </Tab.Pane>
              <Tab.Pane eventKey="rooms">
                <Card>
                  <Card.Header>Chat Rooms ({rooms.length})</Card.Header>
                  <Card.Body>
                    {/* You could create a similar filter/sort mechanism for rooms */}
                    {rooms.map((room) => (
                      <div key={room._id} className="d-flex justify-content-between align-items-center p-2 border-bottom">
                        <div>
                          <strong>{room.title}</strong> <small className="text-muted">({room.messageCount || 0} messages)</small>
                        </div>
                        <div>
                          <Link to={`/room/${room._id}`} className="btn btn-sm btn-outline-primary me-2">View</Link>
                          <Button variant="danger" size="sm" onClick={() => deleteRoom(room._id)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              </Tab.Pane>
            </Tab.Content>
          </Tab.Container>
        </Col>
      </Row>

      {/* Edit User Modal */}
      <Modal show={showEditModal} onHide={handleCloseEditModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit User: {editingUser?.email}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editError && <Alert variant="danger">{editError}</Alert>}
          {editingUser && (
            <Form>
              <Form.Group className="mb-3" controlId="formIsAdmin">
                <Form.Check
                  type="switch"
                  label="Administrator"
                  checked={editingUser.isAdmin}
                  onChange={(e) => setEditingUser({ ...editingUser, isAdmin: e.target.checked })}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="formIsPremium">
                <Form.Check
                  type="switch"
                  label="Premium User"
                  checked={editingUser.isPremium}
                  onChange={(e) => setEditingUser({ ...editingUser, isPremium: e.target.checked })}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="formPremiumUntil">
                <Form.Label>Premium Access Until</Form.Label>
                <Form.Control
                  type="date"
                  value={editingUser.premiumUntil}
                  onChange={(e) => setEditingUser({ ...editingUser, premiumUntil: e.target.value })}
                  disabled={!editingUser.isPremium}
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseEditModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveChanges}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}