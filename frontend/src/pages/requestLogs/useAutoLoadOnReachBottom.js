import { useEffect, useRef } from 'react';

export default function useAutoLoadOnReachBottom({
  enabled,
  loading,
  loadingMore,
  onReachBottom,
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!enabled || loading || loadingMore) return undefined;

    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onReachBottom();
        }
      },
      {
        rootMargin: '0px 0px 320px 0px',
        threshold: 0,
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [enabled, loading, loadingMore, onReachBottom]);

  return sentinelRef;
}