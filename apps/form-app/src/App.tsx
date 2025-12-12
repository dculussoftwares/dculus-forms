
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LocaleProvider } from './contexts/LocaleContext';
import { Toaster } from '@dculus/ui';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Dashboard } from './components/Dashboard';
import FormsList from './pages/FormsList';
import Responses from './pages/Responses';
import ResponseEdit from './pages/ResponseEdit';
import { ResponseEditHistory } from './pages/ResponseEditHistory';
import ResponsesAnalytics from './pages/ResponsesAnalytics';
import ResponsesIndividual from './pages/ResponsesIndividual';
import { SignUp } from './pages/SignUp';
import { SignIn } from './pages/SignIn';
import { ForgotPassword } from './pages/ForgotPassword';
import Settings from './pages/Settings';
import InviteAcceptance from './pages/InviteAcceptance';
import FormDashboard from './pages/FormDashboard';
import FormAnalytics from './pages/FormAnalytics';
import FormSettings from './pages/FormSettings';
import CollaborativeFormBuilder from './pages/CollaborativeFormBuilder';
import Plugins from './pages/Plugins';
import PluginConfiguration from './pages/PluginConfiguration';
import { Pricing } from './pages/Pricing';
import { CheckoutSuccess } from './pages/subscription/success';
import { CheckoutCancel } from './pages/subscription/cancel';


function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <Routes>
          {/* Public routes */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/invite/:invitationId" element={<InviteAcceptance />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/subscription/success" element={<CheckoutSuccess />} />
          <Route path="/subscription/cancel" element={<CheckoutCancel />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/*" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId" element={
            <ProtectedRoute>
              <FormDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/collaborate/:tab?" element={
            <ProtectedRoute>
              <CollaborativeFormBuilder />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/analytics" element={
            <ProtectedRoute>
              <FormAnalytics />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/settings" element={
            <ProtectedRoute>
              <FormSettings />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/plugins" element={
            <ProtectedRoute>
              <Plugins />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/plugins/configure/:pluginType" element={
            <ProtectedRoute>
              <PluginConfiguration />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/plugins/:pluginId/edit" element={
            <ProtectedRoute>
              <PluginConfiguration />
            </ProtectedRoute>
          } />

          <Route path="/settings/:tab?" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/forms" element={
            <ProtectedRoute>
              <FormsList />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/responses" element={
            <ProtectedRoute>
              <Responses />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/responses/:responseId/edit" element={
            <ProtectedRoute>
              <ResponseEdit />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/responses/:responseId/history" element={
            <ProtectedRoute>
              <ResponseEditHistory />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/responses/analytics" element={
            <ProtectedRoute>
              <ResponsesAnalytics />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/form/:formId/responses/individual" element={
            <ProtectedRoute>
              <ResponsesIndividual />
            </ProtectedRoute>
          } />
          <Route path="/forms/:id/responses" element={
            <ProtectedRoute>
              <Responses />
            </ProtectedRoute>
          } />
          <Route path="/responses" element={
            <ProtectedRoute>
              <Responses />
            </ProtectedRoute>
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
