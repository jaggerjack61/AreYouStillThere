import { useState, useEffect, useCallback } from 'react';
import { policiesAPI, servicesAPI } from '../api';

const EMPTY_FORM = {
  service: '', email_enabled: true,
  notify_on_down: true, notify_on_recovery: true,
  notify_on_retry_failure: false, cooldown_seconds: 300,
  recipient_emails: '',
};

export default function NotificationSettingsPage() {
  const [policies, setPolicies] = useState([]);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  const fetchPolicies = useCallback(async () => {
    const { data } = await policiesAPI.list();
    setPolicies(data.results || data);
  }, []);

  useEffect(() => {
    fetchPolicies();
    servicesAPI.list().then(({ data }) => setServices(data.results || data));
  }, [fetchPolicies]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      recipient_emails: form.recipient_emails
        .split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (editingId) {
        await policiesAPI.update(editingId, payload);
      } else {
        await policiesAPI.create(payload);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      fetchPolicies();
      setMessage(editingId ? 'Updated' : 'Created');
    } catch {
      setMessage('Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this policy?')) return;
    await policiesAPI.delete(id);
    fetchPolicies();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Notification Policies</h1>
        <p className="page-desc">Per-service notification rules and recipients</p>
      </div>

      {message && <div className="toast">{message}</div>}

      <form onSubmit={handleSubmit} className="form-card">
        <fieldset className="form-section">
          <legend>{editingId ? 'Edit Policy' : 'New Policy'}</legend>
          <label className="form-field"><span>Service</span>
            <select name="service" value={form.service} onChange={handleChange} required>
              <option value="">Select…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="form-field"><span>Recipients (comma-separated)</span>
            <input name="recipient_emails" value={form.recipient_emails} onChange={handleChange}
              placeholder="admin@example.com, ops@example.com" />
          </label>
          <label className="form-field"><span>Cooldown (seconds)</span>
            <input name="cooldown_seconds" type="number" value={form.cooldown_seconds} onChange={handleChange} min={0} />
          </label>
          <div className="form-row">
            <label className="form-check"><input name="email_enabled" type="checkbox" checked={form.email_enabled} onChange={handleChange} /><span>Email Enabled</span></label>
            <label className="form-check"><input name="notify_on_down" type="checkbox" checked={form.notify_on_down} onChange={handleChange} /><span>On Down</span></label>
            <label className="form-check"><input name="notify_on_recovery" type="checkbox" checked={form.notify_on_recovery} onChange={handleChange} /><span>On Recovery</span></label>
            <label className="form-check"><input name="notify_on_retry_failure" type="checkbox" checked={form.notify_on_retry_failure} onChange={handleChange} /><span>On Retry Failure</span></label>
          </div>
        </fieldset>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Create'}</button>
          {editingId && <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>Cancel</button>}
        </div>
      </form>

      {policies.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Service</th><th>Email</th><th>Down</th><th>Recovery</th><th>Cooldown</th><th>Recipients</th><th></th></tr></thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td>{services.find((s) => s.id === p.service)?.name || p.service}</td>
                  <td>{p.email_enabled ? '✓' : '—'}</td>
                  <td>{p.notify_on_down ? '✓' : '—'}</td>
                  <td>{p.notify_on_recovery ? '✓' : '—'}</td>
                  <td>{p.cooldown_seconds}s</td>
                  <td>{(p.recipient_emails || []).join(', ')}</td>
                  <td className="actions-cell">
                    <button className="btn btn-sm btn-secondary" onClick={() => {
                      setEditingId(p.id);
                      setForm({ ...p, recipient_emails: (p.recipient_emails || []).join(', ') });
                    }}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>Delete</button>
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
