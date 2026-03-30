import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import IncidentsPage from './IncidentsPage';
import { incidentsAPI, servicesAPI } from '../api';

jest.mock('../api', () => ({
  incidentsAPI: {
    list: jest.fn(),
    patch: jest.fn(),
  },
  servicesAPI: {
    list: jest.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <IncidentsPage />
    </MemoryRouter>,
  );
}

describe('IncidentsPage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('truncates long auto reasons and exposes the full value in a hover card trigger', async () => {
    const autoReason = 'Upstream gateway returned a cascading timeout after three retries while the regional edge cache kept serving stale origin metadata.';

    servicesAPI.list.mockResolvedValue({
      data: [{ id: 7, name: 'Payments API' }],
    });
    incidentsAPI.list.mockResolvedValue({
      data: [{
        id: 11,
        service: 7,
        service_name: 'Payments API',
        status: 'OPEN',
        started_at: '2026-03-30T09:00:00Z',
        duration_display: '5m 2s',
        auto_reason: autoReason,
        user_reason: '',
      }],
    });

    renderPage();

    const trigger = await screen.findByLabelText(autoReason);

    expect(trigger.textContent.endsWith('...')).toBe(true);
    expect(trigger.textContent.length).toBeLessThan(autoReason.length);

    fireEvent.focus(trigger);

    expect(screen.getByRole('tooltip')).toHaveTextContent(autoReason);
    await waitFor(() => {
      expect(incidentsAPI.list).toHaveBeenCalledWith({});
    });
  });
});