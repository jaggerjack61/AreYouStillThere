import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import DashboardPage from './DashboardPage';
import { incidentsAPI, servicesAPI } from '../api';

jest.mock('../api', () => ({
  servicesAPI: {
    list: jest.fn(),
    bulkStats: jest.fn(),
  },
  incidentsAPI: {
    list: jest.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('refreshes dashboard metrics on the polling interval', async () => {
    servicesAPI.list
      .mockResolvedValueOnce({
        data: [{
          id: 7,
          name: 'Google',
          url: 'https://google.com',
          is_active: true,
          total_check_count: 125000,
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          id: 7,
          name: 'Google',
          url: 'https://google.com',
          is_active: false,
          total_check_count: 99000,
        }],
      });

    servicesAPI.bulkStats
      .mockResolvedValueOnce({
        data: [{
          service_id: 7,
          uptime_24h: 100,
          avg_response_time_24h: 120,
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          service_id: 7,
          uptime_24h: 50,
          avg_response_time_24h: 300,
        }],
      });

    incidentsAPI.list
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 9, status: 'OPEN' }] });

    renderPage();

    expect(await screen.findByText('100.0%')).toBeInTheDocument();
    expect(screen.getByText('120ms')).toBeInTheDocument();
    expect(screen.getByText('0.1M')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      expect(servicesAPI.list).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('300ms')).toBeInTheDocument();
    expect(screen.getByText('99K')).toBeInTheDocument();
  });
});