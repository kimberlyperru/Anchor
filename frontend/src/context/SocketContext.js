import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { useUser } from './UserContext';
import API from '../utils/api';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user, logout } = useUser(); // Get user and logout function
  const refreshTimeoutId = useRef(null); // Use a ref to hold the timeout ID

  // Effect for managing the socket connection lifecycle
  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      const newSocket = io('http://localhost:5000', {
        auth: {
          token: token
        }
      });

      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        // If the error is due to an invalid token, you might want to log the user out.
        if (err.message === 'Invalid token') {
          logout();
        }
      });

      setSocket(newSocket);

      return () => {
        console.log('Closing socket connection.');
        newSocket.close();
        setSocket(null);
      };
    } else if (socket) {
      // If there's no user but a socket exists, disconnect it.
      socket.close();
      setSocket(null);
    }
  }, [user, logout]); // Only depends on user and logout

  // Effect for managing token refresh scheduling
  useEffect(() => {
    const scheduleRefresh = (currentToken) => {
      // Clear any existing timer
      if (refreshTimeoutId.current) {
        clearTimeout(refreshTimeoutId.current);
      }

      try {
        const payload = JSON.parse(atob(currentToken.split('.')[1]));
        const expires = payload.exp * 1000;
        // Refresh 1 minute before expiry, or at 90% of its lifetime, whichever is sooner.
        const timeout = expires - Date.now() - 60 * 1000;

        if (timeout > 0) {
          refreshTimeoutId.current = setTimeout(async () => {
            try {
              console.log('Refreshing token...');
              const { data } = await API.post('/auth/refresh-token');
              localStorage.setItem('token', data.token);
              // The socket will auto-reconnect with the new token on the next connection attempt
              // or you can emit an event to update it live if your backend supports it.
              if (socket && socket.connected) {
                socket.auth.token = data.token; // Update auth object
                socket.disconnect().connect(); // Reconnect with new token
                console.log('Socket reconnected with new token.');
              }
              scheduleRefresh(data.token); // Schedule the next refresh
            } catch (error) {
              console.error('Could not refresh token:', error);
              logout(); // Log out the user on refresh failure
            }
          }, timeout);
        }
      } catch (e) {
        console.error("Failed to parse token or schedule refresh:", e);
      }
    };

    if (user && socket) {
      const token = localStorage.getItem('token');
      if (token) {
        scheduleRefresh(token);
      }
    }

    // Cleanup: clear the timeout when the component unmounts or dependencies change.
    return () => {
      if (refreshTimeoutId.current) {
        clearTimeout(refreshTimeoutId.current);
      }
    };
  }, [user, socket, logout]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};