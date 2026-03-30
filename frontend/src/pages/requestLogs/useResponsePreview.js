import { useCallback, useState } from 'react';

import { checkResultsAPI } from '../../api';

const INITIAL_STATE = {
  previewLogId: null,
  previewDetail: null,
  previewLoading: false,
  previewError: '',
  viewerMode: 'json',
};

export default function useResponsePreview() {
  const [detailCache, setDetailCache] = useState({});
  const [state, setState] = useState(INITIAL_STATE);

  const setViewerMode = useCallback((viewerMode) => {
    setState((current) => ({ ...current, viewerMode }));
  }, []);

  const openPreview = useCallback(async (log) => {
    const cachedDetail = detailCache[log.id];
    setState({ ...INITIAL_STATE, previewLogId: log.id, viewerMode: 'json' });

    if (cachedDetail) {
      setState((current) => ({
        ...current,
        previewDetail: cachedDetail,
      }));
      return;
    }

    setState((current) => ({ ...current, previewLoading: true }));

    try {
      const { data } = await checkResultsAPI.get(log.id);
      setDetailCache((current) => ({ ...current, [log.id]: data }));
      setState((current) => ({
        ...current,
        previewDetail: data,
        previewLoading: false,
      }));
    } catch {
      setState((current) => ({
        ...current,
        previewLoading: false,
        previewError: 'Failed to load the full response body.',
      }));
    }
  }, [detailCache]);

  const closePreview = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    closePreview,
    openPreview,
    setViewerMode,
  };
}