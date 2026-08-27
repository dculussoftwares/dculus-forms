import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from './hooks/useAuth';
import AdminLayout from './components/AdminLayout';
import LoginPage from './pages/LoginPage';
import { LoadingSpinner } from '@dculus/ui';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const OrganizationsPage = lazy(() => import('./pages/OrganizationsPage'));
const OrganizationDetailPage = lazy(() =>
  import('./pages/organizations/OrganizationDetailPage').then(m => ({ default: m.OrganizationDetailPage }))
);
const UsersPage = lazy(() =>
  import('./pages/users/UsersPage').then(m => ({ default: m.UsersPage }))
);
const UserDetailPage = lazy(() =>
  import('./pages/users/UserDetailPage').then(m => ({ default: m.UserDetailPage }))
);
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const PlansPage = lazy(() => import('./pages/PlansPage'));
const EmailPreviewsPage = lazy(() => import('./pages/EmailPreviewsPage'));

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <LoadingSpinner />
  </div>
);

class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', fontFamily: 'sans-serif' }}>
          <p style={{ color: '#6b7280' }}>Something went wrong.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <LoginPage />;
  }

  return (
    <AdminLayout>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/organizations" element={<OrganizationsPage />} />
          <Route path="/organizations/:orgId" element={<OrganizationDetailPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/:userId" element={<UserDetailPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/email-previews" element={<EmailPreviewsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
}

const WrappedApp: React.FC = () => (
  <AdminErrorBoundary>
    <App />
  </AdminErrorBoundary>
);

export default WrappedApp;