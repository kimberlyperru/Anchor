import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import App from './App';

test('renders learn react link', () => {
  render(
    <UserProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </UserProvider>
  );
  const linkElement = screen.getByText(/Anchor/i);
  expect(linkElement).toBeInTheDocument();
});
