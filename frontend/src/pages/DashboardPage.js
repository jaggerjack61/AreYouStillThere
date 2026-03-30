import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import LiveStatus from '../components/LiveStatus';
import { servicesAPI, incidentsAPI } from '../api';
import useLiveRefresh from '../useLiveRefresh';

function formatCompactCount(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return '0';
  }

  const units = ['', 'K', 'M', 'B'];
  let displayValue = numericValue;
  let unitIndex = 0;

  while (displayValue >= 100 && unitIndex < units.length - 1) {
    displayValue /= 1000;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${Math.round(displayValue)}`;
  }

  const formattedValue = displayValue < 10
    ? displayValue.toFixed(1)
    : Math.round(displayValue).toString();

  return `${formattedValue}${units[unitIndex]}`;
}

function StatusDot({ isUp }) {
  return (
    <span
      className={`status-dot ${isUp ? 'status-up' : 'status-down'}`}
      title={isUp ? 'Up' : 'Down'}
    />
  );
}

function isServiceOperational(service) {
  return service.is_active && service.status === 'UP';
}

function ServiceCard({ service }) {
  const isOperational = isServiceOperational(service);

  return (
    <Link to={`/services/${service.id}`} className="service-card">
      <div className="service-card-header">
        <StatusDot isUp={isOperational} />
        <h3>{service.name}</h3>
      </div>
      <p className="service-url">{service.url}</p>
      <div className="service-card-stats">
        <div className="stat-pill">
          <span className="stat-label">Uptime</span>
          <span className="stat-value">{service.uptime ?? '—'}%</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Avg</span>
          <span className="stat-value">{service.avgMs ?? '—'}ms</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Checks</span>
          <span className="stat-value">{formatCompactCount(service.totalChecks)}</span>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [services, setServices] = useState([]);
  const [summary, setSummary] = useState({ total: 0, up: 0, down: 0, incidents: 0 });
  const loadDashboard = useCallback(async () => {
    const [{ data: svcData }, { data: bulkStats }, { data: incData }] = await Promise.all([
      servicesAPI.list(),
      servicesAPI.bulkStats(),
      incidentsAPI.list({ status: 'OPEN' }),
    ]);
    const svcList = svcData.results || svcData;
    const statsMap = Object.fromEntries(
      (bulkStats.results || bulkStats).map((s) => [s.service_id, s]),
    );

    const enriched = svcList.map((svc) => {
      const stats = statsMap[svc.id];
      return {
        ...svc,
        uptime: stats?.uptime_24h?.toFixed(1),
        avgMs: stats?.avg_response_time_24h?.toFixed(0),
        totalChecks: svc.total_check_count,
      };
    });

    const upCount = enriched.filter(isServiceOperational).length;
    const incList = incData.results || incData;

    setSummary({
      total: enriched.length,
      up: upCount,
      down: enriched.length - upCount,
      incidents: incList.length,
    });
    setServices(enriched);
  }, []);

  const { loading, refreshing, lastUpdated } = useLiveRefresh(
    loadDashboard,
    [loadDashboard],
  );

  if (loading) return <div className="page-loader">Loading…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="page-desc">Real-time overview of all monitored services</p>
        <LiveStatus refreshing={refreshing} lastUpdated={lastUpdated} />
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <span className="summary-number">{summary.total}</span>
          <span className="summary-label">Total Services</span>
        </div>
        <div className="summary-card summary-up">
          <span className="summary-number">{summary.up}</span>
          <span className="summary-label">Operational</span>
        </div>
        <div className="summary-card summary-down">
          <span className="summary-number">{summary.down}</span>
          <span className="summary-label">Down</span>
        </div>
        <div className="summary-card summary-incident">
          <span className="summary-number">{summary.incidents}</span>
          <span className="summary-label">Open Incidents</span>
        </div>
      </div>

      <div className="section-header">
        <h2>Services</h2>
        <Link to="/services/new" className="btn btn-primary">+ Add Service</Link>
      </div>

      {services.length === 0 ? (
        <div className="empty-state">
          <p>No services configured yet.</p>
          <Link to="/services/new" className="btn btn-primary">Add your first service</Link>
        </div>
      ) : (
        <div className="services-grid">
          {services.map((svc) => (
            <ServiceCard key={svc.id} service={svc} />
          ))}
        </div>
      )}
    </div>
  );
}
