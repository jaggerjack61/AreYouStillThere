export const REQUEST_LOG_PAGE_SIZE = 50;
export const DEFAULT_ORDERING = '-checked_at';

export const RESULT_FILTER_OPTIONS = [
  { value: '', label: 'All results' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILURE', label: 'Failure' },
];

export const SORT_FIELD_OPTIONS = [
  { value: 'checked_at', label: 'Checked at' },
  { value: 'service__name', label: 'Service' },
  { value: 'is_successful', label: 'Result' },
  { value: 'status_code', label: 'Status code' },
  { value: 'response_time_ms', label: 'Response time' },
  { value: 'response_snippet', label: 'Response preview' },
];

export const SORT_DIRECTION_OPTIONS = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
];

export function buildOrdering(field, direction) {
  return direction === 'asc' ? field : `-${field}`;
}

export function getSortDirection(ordering) {
  return ordering.startsWith('-') ? 'desc' : 'asc';
}

export function getSortField(ordering) {
  return ordering.replace(/^-/, '') || 'checked_at';
}

export function parseRequestLogQuery(searchParams) {
  return {
    service: searchParams.get('service') || '',
    result: searchParams.get('result') || '',
    search: searchParams.get('search') || '',
    ordering: searchParams.get('ordering') || DEFAULT_ORDERING,
  };
}

export function buildRequestLogSearchParams(query) {
  const params = {};

  if (query.service) params.service = query.service;
  if (query.result) params.result = query.result;
  if (query.search) params.search = query.search;
  if (query.ordering && query.ordering !== DEFAULT_ORDERING) {
    params.ordering = query.ordering;
  }

  return params;
}

export function buildRequestLogApiParams(query, page) {
  const params = { page };

  if (query.service) params.service = query.service;
  if (query.result) params.result = query.result;
  if (query.search) params.search = query.search;
  if (query.ordering && query.ordering !== DEFAULT_ORDERING) {
    params.ordering = query.ordering;
  }

  return params;
}

export function normalizePaginatedResults(data) {
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data };
  }

  return {
    count: data.count ?? 0,
    next: data.next ?? null,
    previous: data.previous ?? null,
    results: data.results ?? [],
  };
}