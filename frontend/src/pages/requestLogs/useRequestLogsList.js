import { useCallback, useEffect, useState } from 'react';

import { checkResultsAPI } from '../../api';
import {
  buildRequestLogApiParams,
  normalizePaginatedResults,
} from './constants';

const INITIAL_STATE = {
  logs: [],
  totalCount: 0,
  page: 1,
  hasNextPage: false,
  loading: true,
  loadingMore: false,
  error: '',
};

function buildListState(data, page, previousLogs = []) {
  const payload = normalizePaginatedResults(data);

  return {
    logs: page === 1 ? payload.results : [...previousLogs, ...payload.results],
    totalCount: payload.count,
    page,
    hasNextPage: Boolean(payload.next),
    loading: false,
    loadingMore: false,
    error: '',
  };
}

export default function useRequestLogsList(query) {
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    let active = true;

    async function loadFirstPage() {
      setState({ ...INITIAL_STATE, loading: true });

      try {
        const { data } = await checkResultsAPI.list(
          buildRequestLogApiParams(query, 1),
        );
        if (!active) return;
        setState(buildListState(data, 1));
      } catch {
        if (!active) return;
        setState({
          ...INITIAL_STATE,
          loading: false,
          error: 'Failed to load request logs.',
        });
      }
    }

    void loadFirstPage();

    return () => {
      active = false;
    };
  }, [query.ordering, query.result, query.search, query.service]);

  const loadNextPage = useCallback(async () => {
    if (state.loading || state.loadingMore || !state.hasNextPage) return;

    const nextPage = state.page + 1;
    setState((current) => ({ ...current, loadingMore: true, error: '' }));

    try {
      const { data } = await checkResultsAPI.list(
        buildRequestLogApiParams(query, nextPage),
      );
      setState((current) => buildListState(data, nextPage, current.logs));
    } catch {
      setState((current) => ({
        ...current,
        loadingMore: false,
        error: 'Failed to load more request logs.',
      }));
    }
  }, [query, state.hasNextPage, state.loading, state.loadingMore, state.page]);

  return {
    ...state,
    visibleCount: state.logs.length,
    loadNextPage,
  };
}