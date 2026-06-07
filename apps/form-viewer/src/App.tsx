import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client/react';
import { Button } from '@dculus/ui';
import { client } from './services/apolloClient';
import Header from './components/Header';
import Home from './pages/Home';
import DemoPage from './components/DemoPage';
import FormViewer from './pages/FormViewer';

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
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="min-h-screen bg-background">
          <Routes>
            {/* Public form routes - no header */}
            <Route path="/f/:shortUrl" element={<FormViewerErrorBoundary><FormViewer /></FormViewerErrorBoundary>} />
            {/* Legacy URL format support (without /f/ prefix) */}
            <Route path="/:shortUrl" element={<FormViewerErrorBoundary><FormViewer /></FormViewerErrorBoundary>} />

            {/* Main app routes - with header */}
            <Route
              path="/*"
              element={
                <>
                  <Header />
                  <main className="container mx-auto px-4 py-8">
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/demo" element={<DemoPage />} />
                    </Routes>
                  </main>
                </>
              }
            />
          </Routes>
        </div>
      </Router>
    </ApolloProvider>
  );
}

export default App;
