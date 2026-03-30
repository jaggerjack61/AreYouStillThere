import { useEffect, useRef, useState } from 'react';


export const LIVE_REFRESH_INTERVAL_MS = 10000;


export default function useLiveRefresh(
  fetchData,
  dependencies,
  intervalMs = LIVE_REFRESH_INTERVAL_MS,
) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const fetchRef = useRef(fetchData);
  const pendingRef = useRef(null);

  fetchRef.current = fetchData;

  useEffect(() => {
    let active = true;

    const runFetch = async (background = false) => {
      if (pendingRef.current) return pendingRef.current;
      if (background && typeof document !== 'undefined' && document.hidden) {
        return null;
      }

      if (active) {
        background ? setRefreshing(true) : setLoading(true);
      }

      const request = fetchRef.current()
        .then(() => {
          if (active) setLastUpdated(new Date());
        })
        .catch(() => null)
        .finally(() => {
          pendingRef.current = null;
          if (active) {
            setLoading(false);
            setRefreshing(false);
          }
        });

      pendingRef.current = request;
      return request;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) void runFetch(true);
    };

    void runFetch();
    const intervalId = window.setInterval(() => {
      void runFetch(true);
    }, intervalMs);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, ...dependencies]);

  return { loading, refreshing, lastUpdated };
}