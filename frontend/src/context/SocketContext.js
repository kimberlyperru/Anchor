import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useUser } from './UserContext'; // We'll get the user from the existing UserContext
import API from '../utils/api'; // Import your API utility

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useUser(); // Get the current logged-in user

  useEffect(() => {
    // Set up a timer to refresh the token before it expires
    if (user) {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Function to refresh the token
      const refreshToken = async () => {
        try {
          console.log('Refreshing token...');
          const { data } = await API.post('/auth/refresh-token');
          const newToken = data.token;
          localStorage.setItem('token', newToken);

          // Update the active socket connection with the new token
          if (socket && socket.connected) {
            socket.emit('updateToken', newToken, (response) => {
              if (response.status === 'ok') {
                console.log('Socket token successfully updated.');
              } else {
                console.error('Failed to update socket token:', response.message);
              }
            });
          }
          // Schedule the next refresh
          scheduleRefresh(newToken);
        } catch (error) {
          console.error('Could not refresh token:', error);
          // Handle refresh failure (e.g., log user out)
        }
      };

      // Function to schedule the refresh
      const scheduleRefresh = (currentToken) => {
        const payload = JSON.parse(atob(currentToken.split('.')[1]));
        const expires = payload.exp * 1000;
        const timeout = expires - Date.now() - (60 * 1000); // 1 minute before expiry
        
        if (timeout > 0) {
          setTimeout(refreshToken, timeout);
        }
      };

      scheduleRefresh(token);
    }

    // Only attempt to connect if the user is logged in
    if (user) {
      const token = localStorage.getItem('token');

      // Connect to the socket server with the JWT for authentication
      const newSocket = io('http://localhost:5000', { // Your backend URL
        auth: {
          token: token
        }
      });

      newSocket.on('connect_error', (err) => {
        // Handle authentication errors
        console.error('Socket connection error:', err.message);
      });

      setSocket(newSocket);

      // Disconnect when the component unmounts or user logs out
      return () => newSocket.close();
    }
  }, [user, socket]); // Re-run this effect when the user logs in or out

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};