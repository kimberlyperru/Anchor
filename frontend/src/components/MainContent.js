import React from 'react';
import { useUser } from '../context/UserContext';
import ChatRoom from './ChatRoom';
import AiConsultant from './AiConsultant';
import { useParams, Navigate } from 'react-router-dom';

export default function MainContent() {
  const { user } = useUser();
  const { id } = useParams();

  if (id) {
    return <ChatRoom />;
  } else if (user && user.isPremium) {
    return <AiConsultant />;
  } else {
    return <Navigate to="/dashboard" />;
  }
}
