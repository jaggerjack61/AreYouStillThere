import { useState, useEffect } from 'react';
import { logsAPI, servicesAPI } from '../api';

export default function NotificationLogsPage() {
  const [logs, setLogs] = useState([]);
  const [services, setServices] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    servicesAPI.list().then(({ data }) => setServices(data.results || data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = filter ? { service: filter } : {};
    logsAPI.list(params)
      .then(({ data }) => setLogs(data.results || data))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Notification Logs</h1>
        <p className="page-desc">History of all notification attempts</p>
      </div>

      <div className="filter-bar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All Services</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="page-loader">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="empty-state"><p>No notification logs.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Time</th><th>Service</th><th>Event</th><th>Status</th><th>Recipients</th><th>Error</th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td data-label="Time" className="table-cell-nowrap">{new Date(log.sent_at).toLocaleString()}</td>
                  <td data-label="Service">{services.find((s) => s.id === log.service)?.name || log.service}</td>
                  <td data-label="Event" className="table-cell-inline"><span className="badge badge-neutral">{log.event_type}</span></td>
                  <td data-label="Status" className="table-cell-inline">
                    <span className={`badge badge-${log.status === 'SENT' ? 'green' : log.status === 'FAILED' ? 'red' : 'yellow'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td data-label="Recipients">{(log.recipients || []).join(', ')}</td>
                  <td data-label="Error" className="error-cell">{log.error_message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
