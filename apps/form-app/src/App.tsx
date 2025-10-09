
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from '@dculus/ui';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Dashboard } from './components/Dashboard';
import FormsList from './pages/FormsList';
import FormBuilder from './pages/FormBuilder';
import FormViewer from './pages/FormViewer';
import Responses from './pages/Responses';
import ResponseEdit from './pages/ResponseEdit';
import { ResponseEditHistory } from './pages/ResponseEditHistory';
import ResponsesAnalytics from './pages/ResponsesAnalytics';
import ResponsesIndividual from './pages/ResponsesIndividual';
import { SignUp } from './pages/SignUp';
import { SignIn } from './pages/SignIn';
import { SignInOTP } from './pages/SignInOTP';
import { ForgotPassword } from './pages/ForgotPassword';
import Settings from './pages/Settings';
import InviteAcceptance from './pages/InviteAcceptance';
import FormDashboard from './pages/FormDashboard';
import FormAnalytics from './pages/FormAnalytics';
import FormSettings from './pages/FormSettings';
import CollaborativeFormBuilder from './pages/CollaborativeFormBuilder';


function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <Routes>
          {/* Public routes */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signin/otp" element={<SignInOTP />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/invite/:invitationId" element={<InviteAcceptance />} />
          
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

          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/forms" element={
            <ProtectedRoute>
              <FormsList />
            </ProtectedRoute>
          } />
          <Route path="/forms/new" element={
            <ProtectedRoute>
              <FormBuilder />
            </ProtectedRoute>
          } />
          <Route path="/forms/:id" element={
            <ProtectedRoute>
              <FormViewer />
            </ProtectedRoute>
          } />
          <Route path="/forms/:id/edit" element={
            <ProtectedRoute>
              <FormBuilder />
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
  );
}

export default App; 