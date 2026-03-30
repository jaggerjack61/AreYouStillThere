import { useCallback, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { reportsAPI } from '../api';
import LiveStatus from '../components/LiveStatus';
import useLiveRefresh from '../useLiveRefresh';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [range, setRange] = useState({ start: '', end: '' });
  const [appliedRange, setAppliedRange] = useState({ start: '', end: '' });

  const loadReports = useCallback(async () => {
    const params = {};
    if (appliedRange.start) params.start = appliedRange.start;
    if (appliedRange.end) params.end = appliedRange.end;
    const { data } = await reportsAPI.get(params);
    setReports(data.results || data);
  }, [appliedRange]);

  const { loading, refreshing, lastUpdated } = useLiveRefresh(
    loadReports,
    [loadReports],
  );

  const chartData = reports.map((r) => ({
    name: r.service_name,
    uptime: r.uptime_percentage,
    avgMs: r.avg_response_time?.toFixed(0) || 0,
    incidents: r.incident_count,
  }));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reports</h1>
        <p className="page-desc">Service performance summaries and analytics</p>
        <LiveStatus refreshing={refreshing} lastUpdated={lastUpdated} />
      </div>

      <div className="filter-bar">
        <label className="filter-field">
          <span>Start</span>
          <input
            type="date"
            value={range.start}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
          />
        </label>
        <label className="filter-field">
          <span>End</span>
          <input
            type="date"
            value={range.end}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
          />
        </label>
        <button
          className="btn btn-primary"
          onClick={() => setAppliedRange({ ...range })}
        >
          Apply
        </button>
      </div>

      {loading ? (
        <div className="page-loader">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="empty-state"><p>No data available for this period.</p></div>
      ) : (
        <>
          <div className="chart-container">
            <h3>Uptime by Service</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" fontSize={12} stroke="#999" />
                <YAxis fontSize={12} stroke="#999" unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e8e5e1', fontSize: 13 }} />
                <Bar dataKey="uptime" fill="#e85d3a" radius={[4, 4, 0, 0]} name="Uptime %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Uptime %</th>
                  <th>Avg Response</th>
                  <th>Incidents</th>
                  <th>Total Downtime</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.service_id}>
                    <td>{r.service_name}</td>
                    <td>
                      <span className={`badge badge-${r.uptime_percentage >= 99 ? 'green' : r.uptime_percentage >= 95 ? 'yellow' : 'red'}`}>
                        {r.uptime_percentage?.toFixed(1)}%
                      </span>
                    </td>
                    <td>{r.avg_response_time?.toFixed(0) || '—'}ms</td>
                    <td>{r.incident_count}</td>
                    <td>{formatDuration(r.total_downtime_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}
