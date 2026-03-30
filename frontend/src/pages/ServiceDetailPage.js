import { useCallback, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import LiveStatus from '../components/LiveStatus';
import { servicesAPI, checkResultsAPI, incidentsAPI } from '../api';
import useLiveRefresh from '../useLiveRefresh';

function ResponseChart({ checks }) {
  const data = checks.slice().reverse().map((c) => ({
    time: new Date(c.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ms: c.response_time_ms,
    ok: c.is_successful,
  }));

  return (
    <div className="chart-container">
      <h3>Response Time (24h)</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="time" fontSize={11} stroke="#999" />
          <YAxis fontSize={11} stroke="#999" unit="ms" />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e8e5e1', fontSize: 13 }}
          />
          <Line
            type="monotone"
            dataKey="ms"
            stroke="#e85d3a"
            strokeWidth={2}
            dot={false}
            name="Response"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function UptimeBar({ checks }) {
  const recent = checks.slice(0, 50).reverse();
  return (
    <div className="uptime-bar-wrap">
      <h3>Uptime (recent checks)</h3>
      <div className="uptime-bar">
        {recent.map((c) => (
          <div
            key={c.id}
            className={`uptime-tick ${c.is_successful ? 'tick-up' : 'tick-down'}`}
            title={`${new Date(c.checked_at).toLocaleString()} — ${c.is_successful ? 'OK' : 'FAIL'}`}
          />
        ))}
      </div>
    </div>
  );
}

function isServiceOperational(service) {
  return service.is_active && service.status === 'UP';
}

export default function ServiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [stats, setStats] = useState(null);
  const [checks, setChecks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const hasLoadedRef = useRef(false);

  const loadServiceDetail = useCallback(async () => {
    try {
      const [svcRes, statsRes, checksRes, incRes] = await Promise.all([
        servicesAPI.get(id),
        servicesAPI.stats(id),
        checkResultsAPI.list({ service: id }),
        incidentsAPI.list({ service: id }),
      ]);
      setService(svcRes.data);
      setStats(statsRes.data);
      setChecks(checksRes.data.results || checksRes.data);
      setIncidents(incRes.data.results || incRes.data);
      hasLoadedRef.current = true;
    } catch (error) {
      if (!hasLoadedRef.current) navigate('/');
      throw error;
    }
  }, [id, navigate]);

  const { loading, refreshing, lastUpdated } = useLiveRefresh(
    loadServiceDetail,
    [loadServiceDetail],
  );

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${service.name}"?`)) return;
    await servicesAPI.delete(id);
    navigate('/');
  };

  if (loading) return <div className="page-loader">Loading…</div>;
  if (!service) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="breadcrumb">
              <Link to="/">Dashboard</Link>
              <span className="breadcrumb-sep">/</span>
              <span>{service.name}</span>
            </div>
            <h1>
              <span className={`status-dot ${isServiceOperational(service) ? 'status-up' : 'status-down'}`} />
              {service.name}
            </h1>
            <p className="page-desc">{service.url}</p>
            <p className="page-desc">Keeping the last {service.log_retention_limit} request logs</p>
            <LiveStatus refreshing={refreshing} lastUpdated={lastUpdated} />
          </div>
          <div className="page-actions">
            <Link to={`/request-logs?service=${id}`} className="btn btn-secondary">Request Logs</Link>
            <Link to={`/services/${id}/edit`} className="btn btn-secondary">Edit</Link>
            <button onClick={handleDelete} className="btn btn-danger">Delete</button>
          </div>
        </div>
      </div>

      {stats && (
        <div className="summary-grid">
          <div className="summary-card summary-up">
            <span className="summary-number">{stats.uptime_24h?.toFixed(1)}%</span>
            <span className="summary-label">Uptime (24h)</span>
          </div>
          <div className="summary-card">
            <span className="summary-number">{stats.avg_response_time_24h?.toFixed(0)}ms</span>
            <span className="summary-label">Avg Response</span>
          </div>
          <div className="summary-card">
            <span className="summary-number">{stats.total_checks_24h}</span>
            <span className="summary-label">Checks (24h)</span>
          </div>
          <div className="summary-card summary-incident">
            <span className="summary-number">{stats.incidents_7d}</span>
            <span className="summary-label">Incidents (7d)</span>
          </div>
        </div>
      )}

      {checks.length > 0 && (
        <>
          <ResponseChart checks={checks} />
          <UptimeBar checks={checks} />
        </>
      )}

      <div className="section-header" style={{ marginTop: 32 }}>
        <h2>Recent Incidents</h2>
        <Link to="/incidents" className="btn btn-secondary">View All</Link>
      </div>

      {incidents.length === 0 ? (
        <p className="empty-hint">No incidents recorded.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {incidents.slice(0, 10).map((inc) => (
                <tr key={inc.id}>
                  <td data-label="Status">
                    <span className={`badge badge-${inc.status === 'OPEN' ? 'red' : 'green'}`}>
                      {inc.status}
                    </span>
                  </td>
                  <td data-label="Started" className="table-cell-nowrap">{new Date(inc.started_at).toLocaleString()}</td>
                  <td data-label="Duration" className="table-cell-nowrap">{inc.duration_display || '—'}</td>
                  <td data-label="Reason">{inc.user_reason || inc.auto_reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
