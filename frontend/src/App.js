import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import ServiceFormPage from './pages/ServiceFormPage';
import IncidentsPage from './pages/IncidentsPage';
import ReportsPage from './pages/ReportsPage';
import RequestLogsPage from './pages/RequestLogsPage';
import SMTPConfigPage from './pages/SMTPConfigPage';
import NotificationSettingsPage from './pages/NotificationSettingsPage';
import NotificationLogsPage from './pages/NotificationLogsPage';

const navigationSections = [
  {
    label: 'Monitoring',
    items: [
      { to: '/', label: 'Dashboard', end: true },
      { to: '/incidents', label: 'Incidents' },
      { to: '/reports', label: 'Reports' },
      { to: '/request-logs', label: 'Request Logs' },
    ],
  },
  {
    label: 'Notifications',
    items: [
      { to: '/smtp-config', label: 'SMTP Config' },
      { to: '/notification-settings', label: 'Policies' },
      { to: '/notification-logs', label: 'Logs' },
    ],
  },
];

function BrandMark() {
  return (
    <>
      <svg className="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
      <span className="brand-name">AreYouStillThere</span>
    </>
  );
}

function NavItemIcon({ to }) {
  switch (to) {
    case '/':
      return <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>;
    case '/incidents':
      return <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
    case '/reports':
      return <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>;
    case '/request-logs':
      return <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V8.414A2 2 0 0016.414 7L13 3.586A2 2 0 0011.586 3H5zm2 5a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>;
    case '/smtp-config':
      return <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>;
    case '/notification-settings':
      return <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>;
    case '/notification-logs':
      return <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>;
    default:
      return null;
  }
}

function NavigationLinks({ mobile = false }) {
  return navigationSections.map((section) => (
    <div key={section.label} className={mobile ? 'mobile-nav-section' : undefined}>
      <span className={mobile ? 'mobile-nav-label' : 'nav-group-label'}>{section.label}</span>
      <div className={mobile ? 'mobile-nav-links' : undefined}>
        {section.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => {
              const baseClass = mobile ? 'nav-item mobile-nav-item' : 'nav-item';
              return `${baseClass}${isActive ? ' active' : ''}`;
            }}
          >
            {!mobile && <NavItemIcon to={item.to} />}
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  ));
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/services/new" element={<ServiceFormPage />} />
      <Route path="/services/:id/edit" element={<ServiceFormPage />} />
      <Route path="/services/:id" element={<ServiceDetailPage />} />
      <Route path="/incidents" element={<IncidentsPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/request-logs" element={<RequestLogsPage />} />
      <Route path="/smtp-config" element={<SMTPConfigPage />} />
      <Route path="/notification-settings" element={<NotificationSettingsPage />} />
      <Route path="/notification-logs" element={<NotificationLogsPage />} />
    </Routes>
  );
}

function SidebarNavigation({ user, logout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <BrandMark />
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        <NavigationLinks />
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-user">{user?.username}</span>
        <button onClick={logout} className="sidebar-logout">Sign out</button>
      </div>
    </aside>
  );
}

function MobileNavigation({ user, logout }) {
  return (
    <>
      <header className="mobile-topbar">
        <div className="mobile-brand">
          <BrandMark />
        </div>
        <div className="mobile-topbar-actions">
          <span className="mobile-user">{user?.username}</span>
          <button onClick={logout} className="sidebar-logout">Sign out</button>
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavigationLinks mobile />
      </nav>
    </>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/welcome" />;
}

function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <SidebarNavigation user={user} logout={logout} />

      <main className="main-content">
        <MobileNavigation user={user} logout={logout} />
        <AppRoutes />
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/*" element={<ProtectedRoute><Layout /></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
