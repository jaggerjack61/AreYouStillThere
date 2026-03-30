import React, { useState, useEffect, useCallback } from 'react';
import { smtpAPI } from '../api';

const EMPTY_FORM = {
  host: '',
  port: 587,
  username: '',
  password: '',
  use_tls: true,
  use_ssl: false,
  from_email: '',
  enabled: true,
};

export default function SMTPConfigPage() {
  const [configs, setConfigs] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await smtpAPI.list();
      setConfigs(res.data.results || res.data);
    } catch {
      setMessage('Failed to load SMTP configs');
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await smtpAPI.patch(editingId, payload);
        setMessage('SMTP config updated');
      } else {
        await smtpAPI.create(form);
        setMessage('SMTP config created');
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      fetchConfigs();
    } catch {
      setMessage('Failed to save SMTP config');
    }
    setLoading(false);
  };

  const handleEdit = (config) => {
    setEditingId(config.id);
    setForm({ ...config, password: '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this SMTP config?')) return;
    try {
      await smtpAPI.delete(id);
      setMessage('Deleted');
      fetchConfigs();
    } catch {
      setMessage('Failed to delete');
    }
  };

  const handleTest = async (id) => {
    if (!testEmail) {
      setMessage('Enter a test email address');
      return;
    }
    setLoading(true);
    try {
      await smtpAPI.test(id, testEmail);
      setMessage('Test email sent successfully!');
    } catch (err) {
      const detail = err.response?.data?.error || 'Failed to send test email';
      setMessage(detail);
    }
    setLoading(false);
  };

  return (
    <div className="page">
      <h2>SMTP Configuration</h2>
      {message && <div className="message">{message}</div>}

      <form onSubmit={handleSubmit} className="form-card">
        <h3>{editingId ? 'Edit Config' : 'New Config'}</h3>
        <div className="form-grid">
          <label>
            Host
            <input name="host" value={form.host} onChange={handleChange}
                   required placeholder="smtp.gmail.com" />
          </label>
          <label>
            Port
            <input name="port" type="number" value={form.port}
                   onChange={handleChange} required />
          </label>
          <label>
            Username
            <input name="username" value={form.username}
                   onChange={handleChange} placeholder="user@gmail.com" />
          </label>
          <label>
            Password
            <input name="password" type="password" value={form.password}
                   onChange={handleChange}
                   placeholder={editingId ? '(unchanged)' : ''} />
          </label>
          <label>
            From Email
            <input name="from_email" type="email" value={form.from_email}
                   onChange={handleChange} required />
          </label>
          <label className="checkbox-label">
            <input name="use_tls" type="checkbox" checked={form.use_tls}
                   onChange={handleChange} />
            Use TLS
          </label>
          <label className="checkbox-label">
            <input name="use_ssl" type="checkbox" checked={form.use_ssl}
                   onChange={handleChange} />
            Use SSL
          </label>
          <label className="checkbox-label">
            <input name="enabled" type="checkbox" checked={form.enabled}
                   onChange={handleChange} />
            Enabled
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {editingId ? 'Update' : 'Create'}
          </button>
          {editingId && (
            <button type="button" onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
            }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="test-section">
        <h3>Test Email</h3>
        <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)}
               placeholder="recipient@example.com" type="email" />
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Host</th>
            <th>Port</th>
            <th>From</th>
            <th>TLS</th>
            <th>SSL</th>
            <th>Enabled</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {configs.map((c) => (
            <tr key={c.id}>
              <td>{c.host}</td>
              <td>{c.port}</td>
              <td>{c.from_email}</td>
              <td>{c.use_tls ? 'Yes' : 'No'}</td>
              <td>{c.use_ssl ? 'Yes' : 'No'}</td>
              <td>{c.enabled ? 'Yes' : 'No'}</td>
              <td className="actions">
                <button onClick={() => handleEdit(c)}>Edit</button>
                <button onClick={() => handleTest(c.id)}
                        disabled={loading}>Test</button>
                <button onClick={() => handleDelete(c.id)}
                        className="danger">Delete</button>
              </td>
            </tr>
          ))}
          {configs.length === 0 && (
            <tr><td colSpan="7">No SMTP configs found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
