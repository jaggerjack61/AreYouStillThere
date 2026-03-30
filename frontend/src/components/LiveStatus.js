import { LIVE_REFRESH_INTERVAL_MS } from '../useLiveRefresh';


function formatLastUpdated(lastUpdated) {
  if (!lastUpdated) return 'Waiting for first sync';
  return `Updated ${lastUpdated.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;
}


export default function LiveStatus({
  refreshing,
  lastUpdated,
  intervalMs = LIVE_REFRESH_INTERVAL_MS,
}) {
  return (
    <div className="live-status" aria-live="polite">
      <span className={`live-status-dot${refreshing ? ' is-refreshing' : ''}`} />
      <span>Live every {Math.round(intervalMs / 1000)}s</span>
      <span className="live-status-separator">/</span>
      <span>{refreshing ? 'Refreshing now' : formatLastUpdated(lastUpdated)}</span>
    </div>
  );
}