import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import API from '../utils/api';

export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await API.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data);
      } catch (error) {
        console.error('Failed to fetch user', error);
        localStorage.removeItem('token'); // Invalid token
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback((token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  // ✅ Memoize the context value to prevent unnecessary re-renders of consumers
  const value = useMemo(() => (
    { user, setUser, login, logout, loading, refreshUser: fetchUser }
  ), [user, loading, login, logout, fetchUser]);

  return (
    <UserContext.Provider value={value}>
      {!loading && children}
    </UserContext.Provider>
  );
};

// Custom hook for easy consumption
export const useUser = () => React.useContext(UserContext);