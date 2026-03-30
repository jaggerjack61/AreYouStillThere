import React, { useState, useEffect, useCallback } from 'react';
import { logsAPI } from '../api';

const STATUS_COLORS = { SENT: '#4caf50', FAILED: '#f44336' };

export default function NotificationLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await logsAPI.list();
      setLogs(res.data.results || res.data);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (loading) return <div className="page"><p>Loading...</p></div>;

  return (
    <div className="page">
      <h2>Notification Logs</h2>
      <button onClick={fetchLogs} className="refresh-btn">Refresh</button>

      <table className="data-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Service</th>
            <th>Event</th>
            <th>Recipients</th>
            <th>Status</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td>{log.service_name}</td>
              <td>
                <span className={`badge badge-${log.event_type.toLowerCase()}`}>
                  {log.event_type}
                </span>
              </td>
              <td>{(log.recipients || []).join(', ')}</td>
              <td>
                <span style={{ color: STATUS_COLORS[log.status] || '#999' }}>
                  {log.status}
                </span>
              </td>
              <td className="error-cell">{log.error_message || '-'}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr><td colSpan="6">No notification logs found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
