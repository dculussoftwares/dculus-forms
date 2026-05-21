import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', fontFamily: 'sans-serif' }}>
          <p style={{ color: '#6b7280' }}>Something went wrong loading this form.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Reload page
          </button>
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
