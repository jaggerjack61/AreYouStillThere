import React, { useState, useEffect, useCallback } from 'react';
import { policiesAPI, servicesAPI } from '../api';

const EMPTY_FORM = {
  service: '',
  email_enabled: false,
  notify_on_down: true,
  notify_on_recovery: true,
  notify_on_retry_failure: false,
  cooldown_seconds: 300,
  recipient_emails: [],
};

export default function NotificationSettingsPage() {
  const [policies, setPolicies] = useState([]);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [recipientInput, setRecipientInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        policiesAPI.list(),
        servicesAPI.list(),
      ]);
      setPolicies(pRes.data.results || pRes.data);
      setServices(sRes.data.results || sRes.data);
    } catch {
      setMessage('Failed to load data');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const addRecipient = () => {
    const email = recipientInput.trim();
    if (email && !form.recipient_emails.includes(email)) {
      setForm((prev) => ({
        ...prev,
        recipient_emails: [...prev.recipient_emails, email],
      }));
      setRecipientInput('');
    }
  };

  const removeRecipient = (email) => {
    setForm((prev) => ({
      ...prev,
      recipient_emails: prev.recipient_emails.filter((e) => e !== email),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        cooldown_seconds: parseInt(form.cooldown_seconds, 10),
      };
      if (editingId) {
        await policiesAPI.update(editingId, payload);
        setMessage('Policy updated');
      } else {
        await policiesAPI.create(payload);
        setMessage('Policy created');
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setRecipientInput('');
      fetchData();
    } catch {
      setMessage('Failed to save policy');
    }
  };

  const handleEdit = (policy) => {
    setEditingId(policy.id);
    setForm({
      service: policy.service,
      email_enabled: policy.email_enabled,
      notify_on_down: policy.notify_on_down,
      notify_on_recovery: policy.notify_on_recovery,
      notify_on_retry_failure: policy.notify_on_retry_failure,
      cooldown_seconds: policy.cooldown_seconds,
      recipient_emails: policy.recipient_emails || [],
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notification policy?')) return;
    try {
      await policiesAPI.delete(id);
      setMessage('Deleted');
      fetchData();
    } catch {
      setMessage('Failed to delete');
    }
  };

  return (
    <div className="page">
      <h2>Notification Settings</h2>
      {message && <div className="message">{message}</div>}

      <form onSubmit={handleSubmit} className="form-card">
        <h3>{editingId ? 'Edit Policy' : 'New Policy'}</h3>

        <label>
          Service
          <select name="service" value={form.service}
                  onChange={handleChange} required>
            <option value="">Select a service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input name="email_enabled" type="checkbox"
                   checked={form.email_enabled} onChange={handleChange} />
            Enable Email Notifications
          </label>
          <label className="checkbox-label">
            <input name="notify_on_down" type="checkbox"
                   checked={form.notify_on_down} onChange={handleChange} />
            Notify on Down
          </label>
          <label className="checkbox-label">
            <input name="notify_on_recovery" type="checkbox"
                   checked={form.notify_on_recovery} onChange={handleChange} />
            Notify on Recovery
          </label>
          <label className="checkbox-label">
            <input name="notify_on_retry_failure" type="checkbox"
                   checked={form.notify_on_retry_failure}
                   onChange={handleChange} />
            Notify on Retry Failure
          </label>
        </div>

        <label>
          Cooldown (seconds)
          <input name="cooldown_seconds" type="number" min="0"
                 value={form.cooldown_seconds} onChange={handleChange} />
        </label>

        <div className="recipients-section">
          <label>Recipient Emails</label>
          <div className="recipient-add">
            <input value={recipientInput}
                   onChange={(e) => setRecipientInput(e.target.value)}
                   placeholder="email@example.com" type="email" />
            <button type="button" onClick={addRecipient}>Add</button>
          </div>
          <ul className="recipient-list">
            {form.recipient_emails.map((email) => (
              <li key={email}>
                {email}
                <button type="button" onClick={() => removeRecipient(email)}
                        className="remove-btn">&times;</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="form-actions">
          <button type="submit">
            {editingId ? 'Update' : 'Create'}
          </button>
          {editingId && (
            <button type="button" onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
            }}>Cancel</button>
          )}
        </div>
      </form>

      <table className="data-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Email</th>
            <th>Down</th>
            <th>Recovery</th>
            <th>Retry</th>
            <th>Cooldown</th>
            <th>Recipients</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((p) => (
            <tr key={p.id}>
              <td>{p.service_name}</td>
              <td>{p.email_enabled ? 'On' : 'Off'}</td>
              <td>{p.notify_on_down ? 'Yes' : 'No'}</td>
              <td>{p.notify_on_recovery ? 'Yes' : 'No'}</td>
              <td>{p.notify_on_retry_failure ? 'Yes' : 'No'}</td>
              <td>{p.cooldown_seconds}s</td>
              <td>{(p.recipient_emails || []).join(', ')}</td>
              <td className="actions">
                <button onClick={() => handleEdit(p)}>Edit</button>
                <button onClick={() => handleDelete(p.id)}
                        className="danger">Delete</button>
              </td>
            </tr>
          ))}
          {policies.length === 0 && (
            <tr><td colSpan="8">No notification policies found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
