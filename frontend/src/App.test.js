import { render, screen } from '@testing-library/react';
import App from './App';

test('renders landing page when not authenticated', () => {
  window.history.pushState({}, '', '/');
  localStorage.clear();
  render(<App />);
  expect(screen.getByText('Start Monitoring')).toBeInTheDocument();
});

test('shows request logs navigation when authenticated', () => {
  localStorage.setItem('access_token', 'token');
  localStorage.setItem('username', 'ops-user');
  window.history.pushState({}, '', '/');

  render(<App />);

  expect(screen.getAllByRole('link', { name: 'Request Logs' }).length).toBeGreaterThan(0);

  localStorage.clear();
});
