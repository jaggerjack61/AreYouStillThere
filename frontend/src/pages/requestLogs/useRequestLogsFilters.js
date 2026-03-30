import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildOrdering,
  buildRequestLogSearchParams,
  getSortDirection,
  getSortField,
  parseRequestLogQuery,
} from './constants';

function toDraftState(query) {
  return {
    service: query.service,
    result: query.result,
    search: query.search,
    sortField: getSortField(query.ordering),
    sortDirection: getSortDirection(query.ordering),
  };
}

export default function useRequestLogsFilters(searchParams, setSearchParams) {
  const query = useMemo(
    () => parseRequestLogQuery(searchParams),
    [searchParams],
  );
  const [draft, setDraft] = useState(() => toDraftState(query));

  useEffect(() => {
    setDraft(toDraftState(query));
  }, [query]);

  const updateDraft = useCallback((field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  }, []);

  const applyFilters = useCallback(() => {
    setSearchParams(buildRequestLogSearchParams({
      service: draft.service,
      result: draft.result,
      search: draft.search.trim(),
      ordering: buildOrdering(draft.sortField, draft.sortDirection),
    }));
  }, [draft, setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  return { draft, query, updateDraft, applyFilters, clearFilters };
}