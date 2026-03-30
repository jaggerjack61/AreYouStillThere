import { Link } from 'react-router-dom';

import { REQUEST_LOG_PAGE_SIZE } from './constants';

function formatResponseTime(value) {
  if (value === null || value === undefined) return '-';
  return `${Math.round(value)}ms`;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function RequestLogDetails({ log }) {
  const details = [
    ['Error', log.error_message || '-'],
    ['Failure Reason', log.failure_reason || '-'],
    ['Network Status', log.network_status || '-'],
  ];

  return (
    <details>
      <summary>View details</summary>
      <div className="log-details-grid">{details.map(([label, value]) => <div key={label} className="log-details-item"><strong>{label}</strong><pre className="log-details-value">{value}</pre></div>)}</div>
    </details>
  );
}

function RequestLogRow({ log, onPreview, serviceName }) {
  return (
    <tr>
      <td>{formatDate(log.checked_at)}</td>
      <td><Link to={`/services/${log.service}`}>{serviceName}</Link></td>
      <td><span className={`badge badge-${log.is_successful ? 'green' : 'red'}`}>{log.is_successful ? 'SUCCESS' : 'FAILURE'}</span></td>
      <td>{log.status_code ?? '-'}</td>
      <td>{formatResponseTime(log.response_time_ms)}</td>
      <td className="error-cell">{log.response_snippet || '-'}</td>
      <td><button type="button" className="btn btn-sm btn-secondary" onClick={() => onPreview(log)}>View Content</button></td>
      <td><RequestLogDetails log={log} /></td>
    </tr>
  );
}

export default function RequestLogsTable({
  autoLoadRef,
  hasNextPage,
  loadingMore,
  logs,
  onPreview,
  servicesById,
  totalCount,
  visibleCount,
}) {
  return (
    <>
      <div className="request-logs-summary"><p className="request-logs-summary-count">Showing {visibleCount} of {totalCount} logs</p><p className="request-logs-summary-note">Auto-loading the next {REQUEST_LOG_PAGE_SIZE} when you reach the bottom.</p></div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Checked At</th><th>Service</th><th>Result</th><th>Status Code</th><th>Response Time</th><th>Response Preview</th><th>Response Body</th><th>Details</th></tr></thead>
          <tbody>{logs.map((log) => <RequestLogRow key={log.id} log={log} onPreview={onPreview} serviceName={log.service_name || servicesById[String(log.service)] || `Service #${log.service}`} />)}</tbody>
        </table>
      </div>
      {hasNextPage && <div className="load-more-wrap"><div ref={autoLoadRef} className="request-logs-sentinel" aria-hidden="true" />{loadingMore ? <p className="request-logs-loading-copy">Loading next {REQUEST_LOG_PAGE_SIZE} logs…</p> : <p className="request-logs-loading-copy">Keep scrolling. The next {REQUEST_LOG_PAGE_SIZE} logs will load automatically.</p>}</div>}
    </>
  );
}