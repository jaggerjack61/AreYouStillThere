import { useState, useEffect, useCallback } from 'react';
import { smtpAPI } from '../api';

const EMPTY_FORM = {
  host: '', port: 587, username: '', password: '',
  use_tls: true, use_ssl: false, from_email: '', enabled: true,
};

export default function SMTPConfigPage() {
  const [configs, setConfigs] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState('');

  const fetchConfigs = useCallback(async () => {
    try {
      const { data } = await smtpAPI.list();
      setConfigs(data.results || data);
    } catch {
      setMessage('Failed to load SMTP configs');
    }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await smtpAPI.patch(editingId, payload);
      } else {
        await smtpAPI.create(form);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      fetchConfigs();
      setMessage(editingId ? 'Updated' : 'Created');
    } catch {
      setMessage('Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this SMTP config?')) return;
    await smtpAPI.delete(id);
    fetchConfigs();
  };

  const handleTest = async (id) => {
    if (!testEmail) return setMessage('Enter a test email');
    try {
      await smtpAPI.test(id, testEmail);
      setMessage('Test email sent!');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>SMTP Configuration</h1>
        <p className="page-desc">Configure email servers for notifications</p>
      </div>

      {message && <div className="toast">{message}</div>}

      <form onSubmit={handleSubmit} className="form-card">
        <fieldset className="form-section">
          <legend>{editingId ? 'Edit Config' : 'New Config'}</legend>
          <div className="form-row">
            <label className="form-field"><span>Host</span>
              <input name="host" value={form.host} onChange={handleChange} required placeholder="smtp.gmail.com" />
            </label>
            <label className="form-field"><span>Port</span>
              <input name="port" type="number" value={form.port} onChange={handleChange} required />
            </label>
          </div>
          <div className="form-row">
            <label className="form-field"><span>Username</span>
              <input name="username" value={form.username} onChange={handleChange} />
            </label>
            <label className="form-field"><span>Password</span>
              <input name="password" type="password" value={form.password} onChange={handleChange}
                placeholder={editingId ? '(unchanged)' : ''} />
            </label>
          </div>
          <label className="form-field"><span>From Email</span>
            <input name="from_email" type="email" value={form.from_email} onChange={handleChange} required />
          </label>
          <div className="form-row">
            <label className="form-check"><input name="use_tls" type="checkbox" checked={form.use_tls} onChange={handleChange} /><span>TLS</span></label>
            <label className="form-check"><input name="use_ssl" type="checkbox" checked={form.use_ssl} onChange={handleChange} /><span>SSL</span></label>
            <label className="form-check"><input name="enabled" type="checkbox" checked={form.enabled} onChange={handleChange} /><span>Enabled</span></label>
          </div>
        </fieldset>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Create'}</button>
          {editingId && <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>Cancel</button>}
        </div>
      </form>

      <div className="filter-bar" style={{ marginTop: 24 }}>
        <label className="filter-field"><span>Test Email</span>
          <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="recipient@example.com" type="email" />
        </label>
      </div>

      {configs.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Host</th><th>Port</th><th>From</th><th>TLS</th><th>Enabled</th><th></th></tr></thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id}>
                  <td data-label="Host">{c.host}</td>
                  <td data-label="Port" className="table-cell-nowrap">{c.port}</td>
                  <td data-label="From">{c.from_email}</td>
                  <td data-label="TLS" className="table-cell-nowrap">{c.use_tls ? '✓' : '—'}</td>
                  <td data-label="Enabled"><span className={`badge badge-${c.enabled ? 'green' : 'red'}`}>{c.enabled ? 'On' : 'Off'}</span></td>
                  <td data-label="Actions" className="actions-cell">
                    <button className="btn btn-sm btn-secondary" onClick={() => { setEditingId(c.id); setForm({ ...c, password: '' }); }}>Edit</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleTest(c.id)}>Test</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)}>Delete</button>
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
