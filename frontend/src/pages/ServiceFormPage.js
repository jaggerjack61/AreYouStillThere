import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  servicesAPI, validationRulesAPI, retryPoliciesAPI,
} from '../api';

const RULE_TYPES = [
  { value: 'CONTAINS', label: 'Response Contains' },
  { value: 'NOT_CONTAINS', label: 'Response Does Not Contain' },
  { value: 'STATUS_CODE', label: 'Status Code Equals' },
];

export default function ServiceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '', url: '', check_type: 'API', method: 'GET',
    timeout_seconds: 30, check_interval_seconds: 300,
    log_retention_limit: 100,
    headers: '{}', body: '', is_active: true,
  });
  const [rules, setRules] = useState([]);
  const [retry, setRetry] = useState({
    enabled: false, max_retries: 3, retry_interval_seconds: 10,
  });
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    async function load() {
      try {
        const { data: svc } = await servicesAPI.get(id);
        setForm({
          name: svc.name, url: svc.url,
          check_type: svc.check_type || 'API',
          method: svc.method || 'GET',
          timeout_seconds: svc.timeout_seconds || 30,
          check_interval_seconds: svc.check_interval_seconds || 300,
          log_retention_limit: svc.log_retention_limit || 100,
          headers: JSON.stringify(svc.headers || {}),
          body: svc.body || '',
          is_active: svc.is_active,
        });
        if (svc.validation_rules) setRules(svc.validation_rules);
        if (svc.retry_policy) setRetry(svc.retry_policy);
      } catch {
        navigate('/');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, isEdit, navigate]);

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const addRule = () => setRules((r) => [...r, { type: 'CONTAINS', value: '', expected: true }]);
  const removeRule = (idx) => setRules((r) => r.filter((_, i) => i !== idx));
  const updateRule = (idx, field, val) => {
    setRules((r) => r.map((rule, i) => i === idx ? { ...rule, [field]: val } : rule));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    let headers = {};
    try {
      headers = JSON.parse(form.headers);
    } catch {
      setError('Invalid JSON in headers');
      return;
    }

    const payload = { ...form, headers };

    try {
      let svcId = id;
      if (isEdit) {
        await servicesAPI.update(id, payload);
      } else {
        const { data } = await servicesAPI.create(payload);
        svcId = data.id;
      }

      // Save validation rules
      for (const rule of rules) {
        if (rule.id) {
          await validationRulesAPI.update(rule.id, { ...rule, service: svcId });
        } else {
          await validationRulesAPI.create({ ...rule, service: svcId });
        }
      }

      // Save retry policy
      try {
        await retryPoliciesAPI.create({ ...retry, service: svcId });
      } catch {
        // update if exists
        const { data: policies } = await retryPoliciesAPI.list({ service: svcId });
        const existing = (policies.results || policies)[0];
        if (existing) {
          await retryPoliciesAPI.update(existing.id, { ...retry, service: svcId });
        }
      }

      navigate(`/services/${svcId}`);
    } catch (err) {
      const detail = err.response?.data;
      setError(
        detail
          ? Object.entries(detail)
            .map(([field, messages]) => `${field}: ${[].concat(messages).join(', ')}`)
            .join(' | ')
          : 'Save failed'
      );
    }
  };

  if (loading) return <div className="page-loader">Loading…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div className="breadcrumb">
          <Link to="/">Dashboard</Link>
          <span className="breadcrumb-sep">/</span>
          <span>{isEdit ? 'Edit Service' : 'New Service'}</span>
        </div>
        <h1>{isEdit ? 'Edit Service' : 'Add Service'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        {error && <div className="form-error">{error}</div>}

        <fieldset className="form-section">
          <legend>Basic Info</legend>
          <div className="form-row">
            <label className="form-field">
              <span>Name</span>
              <input value={form.name} onChange={(e) => updateField('name', e.target.value)} required />
            </label>
            <label className="form-field">
              <span>URL</span>
              <input value={form.url} onChange={(e) => updateField('url', e.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <label className="form-field">
              <span>Method</span>
              <select value={form.method} onChange={(e) => updateField('method', e.target.value)}>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Check Type</span>
              <select value={form.check_type} onChange={(e) => updateField('check_type', e.target.value)}>
                <option value="API">API</option>
                <option value="CONTENT">Content</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label className="form-field">
              <span>Timeout (s)</span>
              <input type="number" value={form.timeout_seconds}
                onChange={(e) => updateField('timeout_seconds', +e.target.value)} min={1} />
            </label>
            <label className="form-field">
              <span>Interval (s)</span>
              <input type="number" value={form.check_interval_seconds}
                onChange={(e) => updateField('check_interval_seconds', +e.target.value)} min={10} />
            </label>
          </div>
          <label className="form-field">
            <span>Service Log Size</span>
            <input
              type="number"
              value={form.log_retention_limit}
              onChange={(e) => updateField('log_retention_limit', +e.target.value)}
              min={1}
            />
            <small>Keep only the last N request logs for this service.</small>
          </label>
          <label className="form-field">
            <span>Headers (JSON)</span>
            <textarea rows={3} value={form.headers}
              onChange={(e) => updateField('headers', e.target.value)} />
          </label>
          <label className="form-field">
            <span>Body</span>
            <textarea rows={3} value={form.body}
              onChange={(e) => updateField('body', e.target.value)} />
          </label>
          <label className="form-check">
            <input type="checkbox" checked={form.is_active}
              onChange={(e) => updateField('is_active', e.target.checked)} />
            <span>Active</span>
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>Validation Rules</legend>
          {rules.map((rule, idx) => (
            <div key={idx} className="form-row rule-row">
              <select value={rule.type} onChange={(e) => updateRule(idx, 'type', e.target.value)}>
                {RULE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input placeholder="Value" value={rule.value}
                onChange={(e) => updateRule(idx, 'value', e.target.value)} />
              <label className="form-check">
                <input type="checkbox" checked={rule.expected}
                  onChange={(e) => updateRule(idx, 'expected', e.target.checked)} />
                <span>Expected</span>
              </label>
              <button type="button" className="btn btn-icon" onClick={() => removeRule(idx)}>×</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={addRule}>
            + Add Rule
          </button>
        </fieldset>

        <fieldset className="form-section">
          <legend>Retry Policy</legend>
          <label className="form-check">
            <input type="checkbox" checked={retry.enabled}
              onChange={(e) => setRetry((r) => ({ ...r, enabled: e.target.checked }))} />
            <span>Enable retries</span>
          </label>
          {retry.enabled && (
            <div className="form-row">
              <label className="form-field">
                <span>Max Retries</span>
                <input type="number" value={retry.max_retries}
                  onChange={(e) => setRetry((r) => ({ ...r, max_retries: +e.target.value }))} min={1} />
              </label>
              <label className="form-field">
                <span>Interval (s)</span>
                <input type="number" value={retry.retry_interval_seconds}
                  onChange={(e) => setRetry((r) => ({ ...r, retry_interval_seconds: +e.target.value }))} min={1} />
              </label>
            </div>
          )}
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {isEdit ? 'Save Changes' : 'Create Service'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
