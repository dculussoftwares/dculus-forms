import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { client } from './services/apolloClient';
import Header from './components/Header';
import Home from './pages/Home';
import DemoPage from './components/DemoPage';
import FormViewer from './pages/FormViewer';

function App() {
  return (
    <ApolloProvider client={client}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="min-h-screen bg-background">
          <Routes>
            {/* Public form routes - no header */}
            <Route path="/f/:shortUrl" element={<FormViewer />} />
            
            {/* Main app routes - with header */}
            <Route path="/*" element={
              <>
                <Header />
                <main className="container mx-auto px-4 py-8">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/demo" element={<DemoPage />} />
                  </Routes>
                </main>
              </>
            } />
          </Routes>
        </div>
      </Router>
    </ApolloProvider>
  );
}

export default App;
