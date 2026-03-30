import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LandingPage.css';

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    title: 'Real-Time Monitoring',
    desc: 'HTTP health checks with configurable intervals, methods, headers, and request bodies.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4l3 3" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
    title: 'Incident Tracking',
    desc: 'Automatic incident creation on outages with duration tracking and resolution history.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    title: 'Email Alerts',
    desc: 'Configurable SMTP notifications for downtime events and recovery with cooldown policies.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    title: 'Uptime Reports',
    desc: 'Incident-based uptime percentages, response time analytics, and downtime summaries.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-brand">
            <svg className="landing-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span>AreYouStillThere</span>
          </div>
          <nav className="landing-nav">
            {user ? (
              <Link to="/" className="landing-nav-link landing-nav-cta">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="landing-nav-link">Sign In</Link>
                <Link to="/register" className="landing-nav-link landing-nav-cta">Get Started</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-inner">
          <span className="landing-eyebrow">Service Monitoring Platform</span>
          <h1 className="landing-title">
            Know the moment<br />your services go down.
          </h1>
          <p className="landing-subtitle">
            Track uptime, catch outages instantly, and get notified before your
            users notice. Simple setup, reliable monitoring.
          </p>
          <div className="landing-cta-row">
            {user ? (
              <Link to="/" className="landing-btn-primary">Open Dashboard</Link>
            ) : (
              <>
                <Link to="/register" className="landing-btn-primary">Start Monitoring</Link>
                <Link to="/login" className="landing-btn-secondary">Sign In</Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="landing-features">
        <div className="landing-features-inner">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature-card">
              <div className="landing-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <span>AreYouStillThere</span>
        <span className="landing-footer-sep">&middot;</span>
        <span>Open-source service monitoring</span>
      </footer>
    </div>
  );
}
