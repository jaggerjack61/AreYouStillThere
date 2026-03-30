import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import RequestLogsPage from './RequestLogsPage';
import { checkResultsAPI, servicesAPI } from '../api';

jest.mock('../api', () => ({
  checkResultsAPI: {
    get: jest.fn(),
    list: jest.fn(),
  },
  servicesAPI: {
    list: jest.fn(),
  },
}));

let intersectionObserverCallback = null;

beforeEach(() => {
  intersectionObserverCallback = null;
  global.IntersectionObserver = class IntersectionObserver {
    constructor(callback) {
      intersectionObserverCallback = callback;
    }

    observe() {}

    unobserve() {}

    disconnect() {}
  };
});

function renderPage(initialEntries = ['/request-logs?service=7']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <RequestLogsPage />
    </MemoryRouter>,
  );
}

describe('RequestLogsPage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('autoloads the next 50 request logs when the bottom sentinel is reached', async () => {
    servicesAPI.list.mockResolvedValue({
      data: [{ id: 7, name: 'Payments API' }],
    });
    checkResultsAPI.list
      .mockResolvedValueOnce({
        data: {
          count: 75,
          next: 'http://localhost:8000/api/check-results/?page=2&service=7',
          previous: null,
          results: Array.from({ length: 50 }, (_, index) => ({
            id: index + 1,
            service: 7,
            service_name: 'Payments API',
            checked_at: '2026-03-30T09:00:00Z',
            is_successful: true,
            status_code: 200,
            response_time_ms: 100 + index,
            response_snippet: `chunk-one-${index + 1}`,
            error_message: '',
            failure_reason: '',
            network_status: '',
          })),
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 75,
          next: null,
          previous: 'http://localhost:8000/api/check-results/?page=1&service=7',
          results: Array.from({ length: 25 }, (_, index) => ({
            id: index + 51,
            service: 7,
            service_name: 'Payments API',
            checked_at: '2026-03-30T09:00:00Z',
            is_successful: true,
            status_code: 200,
            response_time_ms: 150 + index,
            response_snippet: `chunk-two-${index + 51}`,
            error_message: '',
            failure_reason: '',
            network_status: '',
          })),
        },
      });

    renderPage();

    expect(await screen.findByText('chunk-one-1')).toBeInTheDocument();
    expect(screen.getByText('Showing 50 of 75 logs')).toBeInTheDocument();
    expect(screen.getByText('Auto-loading the next 50 when you reach the bottom.')).toBeInTheDocument();

    await act(async () => {
      intersectionObserverCallback?.([
        { isIntersecting: true },
      ]);
    });

    expect(await screen.findByText('chunk-two-75')).toBeInTheDocument();
    expect(screen.getByText('Showing 75 of 75 logs')).toBeInTheDocument();
    expect(checkResultsAPI.list).toHaveBeenNthCalledWith(1, {
      page: 1,
      service: '7',
    });
    expect(checkResultsAPI.list).toHaveBeenNthCalledWith(2, {
      page: 2,
      service: '7',
    });
  });

  test('submits result, search, and ordering controls to the API', async () => {
    servicesAPI.list.mockResolvedValue({
      data: [{ id: 7, name: 'Payments API' }],
    });
    checkResultsAPI.list
      .mockResolvedValueOnce({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [{
            id: 11,
            service: 7,
            service_name: 'Payments API',
            checked_at: '2026-03-30T09:00:00Z',
            is_successful: true,
            status_code: 200,
            response_time_ms: 120,
            response_snippet: 'initial log',
            error_message: '',
            failure_reason: '',
            network_status: '',
          }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [{
            id: 12,
            service: 7,
            service_name: 'Payments API',
            checked_at: '2026-03-30T09:00:00Z',
            is_successful: false,
            status_code: 503,
            response_time_ms: 640,
            response_snippet: 'timeout from edge',
            error_message: 'Gateway timeout',
            failure_reason: 'HTTP_ERROR',
            network_status: 'edge: OK (200)',
          }],
        },
      });

    renderPage();

    expect(await screen.findByText('initial log')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Result'), {
      target: { value: 'FAILURE' },
    });
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'timeout' },
    });
    fireEvent.change(screen.getByLabelText('Sort column'), {
      target: { value: 'status_code' },
    });
    fireEvent.change(screen.getByLabelText('Sort direction'), {
      target: { value: 'asc' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(await screen.findByText('timeout from edge')).toBeInTheDocument();
    expect(checkResultsAPI.list).toHaveBeenNthCalledWith(2, {
      ordering: 'status_code',
      page: 1,
      result: 'FAILURE',
      search: 'timeout',
      service: '7',
    });
  });

  test('uses the shared form field treatment for request log filters', async () => {
    servicesAPI.list.mockResolvedValue({
      data: [{ id: 7, name: 'Payments API' }],
    });
    checkResultsAPI.list.mockResolvedValue({
      data: {
        count: 0,
        next: null,
        previous: null,
        results: [],
      },
    });

    const { container } = renderPage(['/request-logs']);

    const serviceSelect = await screen.findByLabelText('Service');
    const searchInput = screen.getByLabelText('Search');

    expect(serviceSelect.closest('.form-field')).toBeInTheDocument();
    expect(searchInput.closest('.form-field')).toBeInTheDocument();
    expect(container.querySelector('.request-logs-control-shell')).not.toBeInTheDocument();
  });

  test('truncates long response previews and exposes the full value in a hover card trigger', async () => {
    const preview = '<!doctype html><html><body>The origin returned a very long diagnostic payload that should stay out of the button column while still being readable on hover.</body></html>';

    servicesAPI.list.mockResolvedValue({
      data: [{ id: 7, name: 'Payments API' }],
    });
    checkResultsAPI.list.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 14,
          service: 7,
          service_name: 'Payments API',
          checked_at: '2026-03-30T09:00:00Z',
          is_successful: false,
          status_code: 504,
          response_time_ms: 901,
          response_snippet: preview,
          error_message: 'Gateway timeout',
          failure_reason: 'HTTP_ERROR',
          network_status: 'edge: OK (200)',
        }],
      },
    });

    renderPage();

    const trigger = await screen.findByLabelText(preview);

    expect(trigger.textContent.endsWith('...')).toBe(true);
    expect(trigger.textContent.length).toBeLessThan(preview.length);

    fireEvent.focus(trigger);

    expect(screen.getByRole('tooltip')).toHaveTextContent(preview);
  });

  test('shows request log details including response, time, and status code', async () => {
    servicesAPI.list.mockResolvedValue({
      data: [{ id: 7, name: 'Payments API' }],
    });
    checkResultsAPI.list.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 11,
          service: 7,
          service_name: 'Payments API',
          checked_at: '2026-03-30T09:00:00Z',
          is_successful: false,
          status_code: 503,
          response_time_ms: 812.4,
          response_snippet: '{"error":"upstream timeout"}',
          error_message: 'Gateway timeout',
          failure_reason: 'HTTP_ERROR',
          network_status: 'edge: OK (200)',
        }],
      },
    });
    checkResultsAPI.get.mockResolvedValue({
      data: {
        id: 11,
        service: 7,
        service_name: 'Payments API',
        checked_at: '2026-03-30T09:00:00Z',
        is_successful: false,
        status_code: 503,
        response_time_ms: 812.4,
        response_snippet: '{"error":"upstream timeout"}',
        full_response_body: '{"error":"upstream timeout","trace":"abcdef"}',
        error_message: 'Gateway timeout',
        failure_reason: 'HTTP_ERROR',
        network_status: 'edge: OK (200)',
      },
    });

    renderPage();

    expect(await screen.findByRole('link', { name: 'Payments API' })).toBeInTheDocument();
    expect(screen.getByText(/^View$/)).toBeInTheDocument();
    expect(screen.getByText('503')).toBeInTheDocument();
    expect(screen.getByText('812ms')).toBeInTheDocument();
    expect(screen.getByText('{"error":"upstream timeout"}')).toBeInTheDocument();
    expect(screen.getByText('Gateway timeout')).toBeInTheDocument();
    expect(checkResultsAPI.get).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'View Content' }));

    expect(await screen.findByRole('heading', { name: 'Response Body / Content' })).toBeInTheDocument();
    expect(await screen.findByText('Valid JSON')).toBeInTheDocument();
    expect(screen.getByText(/"trace"/)).toBeInTheDocument();
    expect(checkResultsAPI.get).toHaveBeenCalledWith(11);

    await waitFor(() => {
      expect(checkResultsAPI.list).toHaveBeenCalledWith({ page: 1, service: '7' });
    });
  });

  test('renders the html viewer inside the modal', async () => {
    servicesAPI.list.mockResolvedValue({
      data: [{ id: 7, name: 'Payments API' }],
    });
    checkResultsAPI.list.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 12,
          service: 7,
          service_name: 'Payments API',
          checked_at: '2026-03-30T09:00:00Z',
          is_successful: true,
          status_code: 200,
          response_time_ms: 105,
          response_snippet: '<html><body>preview</body></html>',
          error_message: '',
          failure_reason: '',
          network_status: '',
        }],
      },
    });
    checkResultsAPI.get.mockResolvedValue({
      data: {
        id: 12,
        service: 7,
        service_name: 'Payments API',
        checked_at: '2026-03-30T09:00:00Z',
        is_successful: true,
        status_code: 200,
        response_time_ms: 105,
        response_snippet: '<html><body>preview</body></html>',
        full_response_body: '<html><body><h1>preview</h1></body></html>',
        error_message: '',
        failure_reason: '',
        network_status: '',
      },
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'View Content' }));
    await screen.findByRole('heading', { name: 'Response Body / Content' });

    fireEvent.click(screen.getByRole('button', { name: 'HTML Viewer' }));

    const frame = screen.getByTitle('HTML response body viewer');
    expect(frame).toHaveAttribute(
      'srcdoc',
      '<html><body><h1>preview</h1></body></html>',
    );
  });

  test('falls back to the stored response preview when full content is unavailable', async () => {
    servicesAPI.list.mockResolvedValue({
      data: [{ id: 7, name: 'Payments API' }],
    });
    checkResultsAPI.list.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 13,
          service: 7,
          service_name: 'Payments API',
          checked_at: '2026-03-30T09:00:00Z',
          is_successful: true,
          status_code: 200,
          response_time_ms: 105,
          response_snippet: '<html><body><p>truncated preview</p></body></html>',
          error_message: '',
          failure_reason: '',
          network_status: '',
        }],
      },
    });
    checkResultsAPI.get.mockResolvedValue({
      data: {
        id: 13,
        service: 7,
        service_name: 'Payments API',
        checked_at: '2026-03-30T09:00:00Z',
        is_successful: true,
        status_code: 200,
        response_time_ms: 105,
        response_snippet: '<html><body><p>truncated preview</p></body></html>',
        full_response_body: '',
        error_message: '',
        failure_reason: '',
        network_status: '',
      },
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'View Content' }));
    await screen.findByRole('heading', { name: 'Response Body / Content' });
    fireEvent.click(screen.getByRole('button', { name: 'HTML Viewer' }));

    const frame = screen.getByTitle('HTML response body viewer');
    expect(frame).toHaveAttribute(
      'srcdoc',
      '<html><body><p>truncated preview</p></body></html>',
    );
    expect(
      screen.getByText('Full response body unavailable. Showing stored response preview.')
    ).toBeInTheDocument();
  });
});