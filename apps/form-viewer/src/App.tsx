import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import { ApolloProvider } from '@apollo/client/react';
import { Button } from '@dculus/ui';
import { client } from './services/apolloClient';
// FormViewer stays a static import — it's the critical path for nearly every
// visit (deep link to /f/:shortUrl) and lazy-loading it would only add an
// extra network round-trip with no benefit. The secondary routes below are
// lazy so they don't bloat that critical bundle.
import FormViewer from './pages/FormViewer';

const Header = lazy(() => import('./components/Header'));
const Home = lazy(() => import('./pages/Home'));
const DemoPage = lazy(() => import('./components/DemoPage'));
const QuizResultPage = lazy(() => import('./pages/QuizResultPage'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));

class FormViewerErrorBoundary extends React.Component<
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
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="text-muted-foreground">Something went wrong loading this form.</p>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ApolloProvider client={client}>
      <Router>
        <div className="min-h-screen bg-background">
          <Routes>
            {/* Public form routes - no header */}
            <Route path="/f/:shortUrl" element={<FormViewerErrorBoundary><FormViewer /></FormViewerErrorBoundary>} />
            {/* Native Quiz (epic #289, Story 16/#320, D9): "check your result
                later" for identity-gated forms with a deferred grade release. */}
            <Route path="/f/:shortUrl/result" element={<FormViewerErrorBoundary><Suspense fallback={null}><QuizResultPage /></Suspense></FormViewerErrorBoundary>} />
            {/* Respondent sign-in redirect target (Google + one-time-token bridge) */}
            <Route path="/auth/callback" element={<FormViewerErrorBoundary><Suspense fallback={null}><OAuthCallback /></Suspense></FormViewerErrorBoundary>} />
            {/* Legacy URL format support (without /f/ prefix) */}
            <Route path="/:shortUrl/result" element={<FormViewerErrorBoundary><Suspense fallback={null}><QuizResultPage /></Suspense></FormViewerErrorBoundary>} />
            <Route path="/:shortUrl" element={<FormViewerErrorBoundary><FormViewer /></FormViewerErrorBoundary>} />

            {/* Main app routes - with header */}
            <Route
              path="/*"
              element={
                <FormViewerErrorBoundary>
                  <Suspense fallback={null}>
                    <Header />
                    <main className="container mx-auto px-4 py-8">
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/demo" element={<DemoPage />} />
                      </Routes>
                    </main>
                  </Suspense>
                </FormViewerErrorBoundary>
              }
            />
          </Routes>
        </div>
      </Router>
    </ApolloProvider>
  );
}

export default App;
