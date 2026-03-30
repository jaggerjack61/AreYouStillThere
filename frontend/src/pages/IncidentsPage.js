import { useState, useEffect } from 'react';
import { incidentsAPI, servicesAPI } from '../api';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [services, setServices] = useState([]);
  const [filters, setFilters] = useState({ service: '', status: '' });
  const [editing, setEditing] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    servicesAPI.list().then(({ data }) => setServices(data.results || data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (filters.service) params.service = filters.service;
    if (filters.status) params.status = filters.status;
    incidentsAPI.list(params)
      .then(({ data }) => setIncidents(data.results || data))
      .finally(() => setLoading(false));
  }, [filters]);

  const saveReason = async (id) => {
    await incidentsAPI.patch(id, { user_reason: reason });
    setIncidents((prev) =>
      prev.map((inc) => inc.id === id ? { ...inc, user_reason: reason } : inc),
    );
    setEditing(null);
    setReason('');
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Incidents</h1>
        <p className="page-desc">Track and annotate service incidents</p>
      </div>

      <div className="filter-bar">
        <select
          value={filters.service}
          onChange={(e) => setFilters((f) => ({ ...f, service: e.target.value }))}
        >
          <option value="">All Services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      {loading ? (
        <div className="page-loader">Loading…</div>
      ) : incidents.length === 0 ? (
        <div className="empty-state"><p>No incidents found.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Status</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Auto Reason</th>
                <th>Annotation</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id}>
                  <td>{inc.service_name || `Service #${inc.service}`}</td>
                  <td>
                    <span className={`badge badge-${inc.status === 'OPEN' ? 'red' : 'green'}`}>
                      {inc.status}
                    </span>
                  </td>
                  <td>{new Date(inc.started_at).toLocaleString()}</td>
                  <td>{inc.duration_display || '—'}</td>
                  <td>{inc.auto_reason || '—'}</td>
                  <td>
                    {editing === inc.id ? (
                      <div className="inline-edit">
                        <input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="e.g. Scheduled maintenance"
                          autoFocus
                        />
                        <button className="btn btn-sm btn-primary" onClick={() => saveReason(inc.id)}>
                          Save
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditing(null)}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span>{inc.user_reason || '—'}</span>
                    )}
                  </td>
                  <td>
                    {editing !== inc.id && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => { setEditing(inc.id); setReason(inc.user_reason || ''); }}
                      >
                        Annotate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
