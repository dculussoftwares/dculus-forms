
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { LocaleProvider } from './contexts/LocaleContext';
import { Toaster, LoadingSpinner } from '@dculus/ui';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { Dashboard } from './components/Dashboard';
// Auth pages — kept as static imports (small, needed immediately on page load)
import { SignUp } from './pages/SignUp';
import { SignIn } from './pages/SignIn';
import { EmailVerification } from './pages/EmailVerification';
import { ForgotPassword } from './pages/ForgotPassword';
import { MagicLinkCallback } from './pages/MagicLinkCallback';
import { OAuthCallback } from './pages/OAuthCallback';
import { OAuthGoogleSheetsCallback } from './pages/OAuthGoogleSheetsCallback';
import InviteAcceptance from './pages/InviteAcceptance';
import { Pricing } from './pages/Pricing';
import { CheckoutSuccess } from './pages/subscription/success';
import { CheckoutCancel } from './pages/subscription/cancel';

// Heavy pages — lazy-loaded to reduce initial bundle size (P2-20)
const CollaborativeFormBuilder = lazy(() =>
  import('./pages/CollaborativeFormBuilder')
);
const FormAnalytics = lazy(() => import('./pages/FormAnalytics'));
const FormSettings = lazy(() => import('./pages/FormSettings'));
const Integrations = lazy(() => import('./pages/Integrations'));
const PluginConfiguration = lazy(() => import('./pages/PluginConfiguration'));
const ResponsesAnalytics = lazy(() => import('./pages/ResponsesAnalytics'));
const ResponsesIndividual = lazy(() => import('./pages/ResponsesIndividual'));
const ResponseEdit = lazy(() => import('./pages/ResponseEdit'));
const CreateFormWizard = lazy(() => import('./pages/CreateFormWizard'));
const FormDashboard = lazy(() => import('./pages/FormDashboard'));
const Responses = lazy(() => import('./pages/Responses'));
const PdfTemplates = lazy(() => import('./pages/PdfTemplates'));
const PdfTemplateDesigner = lazy(() => import('./pages/PdfTemplateDesigner'));
const Settings = lazy(() => import('./pages/Settings'));
const ResponseEditHistory = lazy(() =>
  import('./pages/ResponseEditHistory').then(m => ({ default: m.ResponseEditHistory }))
);

const RouteSpinner = () => (
  <div className="flex items-center justify-center h-screen">
    <LoadingSpinner size="lg" />
  </div>
);


function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <Routes>
          {/* Public routes — static imports, needed immediately */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/verify-email" element={<EmailVerification />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/magic-link/verify" element={<MagicLinkCallback />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/oauth/google/sheets" element={<OAuthGoogleSheetsCallback />} />
          <Route path="/invite/:invitationId" element={<InviteAcceptance />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/subscription/success" element={<CheckoutSuccess />} />
          <Route path="/subscription/cancel" element={<CheckoutCancel />} />

          {/* Protected routes — lazy-loaded heavy pages wrapped in Suspense (P2-20) */}
          <Route path="/*" element={
            <ProtectedRoute><PageErrorBoundary><Dashboard /></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/*" element={
            <ProtectedRoute><PageErrorBoundary><Dashboard /></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><FormDashboard /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/builder/:tab?" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><CollaborativeFormBuilder /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/analytics" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><FormAnalytics /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/settings" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><FormSettings /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/integrations" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><Integrations /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/integrations/configure/:pluginType" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><PluginConfiguration /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/integrations/:pluginId/edit" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><PluginConfiguration /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/pdf-templates" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><PdfTemplates /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/pdf-templates/:templateId" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><PdfTemplateDesigner /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/settings/:section?" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><Settings /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/forms/create" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><CreateFormWizard /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/responses" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><Responses /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/responses/:responseId/edit" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><ResponseEdit /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/responses/:responseId/history" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><ResponseEditHistory /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/responses/analytics" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><ResponsesAnalytics /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/responses/individual" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><ResponsesIndividual /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/forms/:id/responses" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><Responses /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          <Route path="/responses" element={
            <ProtectedRoute><PageErrorBoundary><Suspense fallback={<RouteSpinner />}><Responses /></Suspense></PageErrorBoundary></ProtectedRoute>
          } />
          {/* Templates is now nested under Dashboard */}
          </Routes>
          <Toaster />
        </div>
      </AuthProvider>
    </LocaleProvider>
  );
}

export default App; 
