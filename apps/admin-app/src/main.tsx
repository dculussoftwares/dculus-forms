import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client/react';
import { BrowserRouter } from 'react-router';
import App from './App.tsx';
import { AuthProvider } from './hooks/useAuth';
import { LocaleProvider } from './contexts/LocaleContext';
import { client } from './services/apolloClient';
import { Toaster } from '@dculus/ui';
import { initOpenPanel } from '@dculus/utils';
import { getOpenPanelApiUrl, getOpenPanelClientId } from './lib/config';
import './index.css';

// Product analytics, page views only (no-op without VITE_OPENPANEL_CLIENT_ID).
initOpenPanel({ clientId: getOpenPanelClientId(), apiUrl: getOpenPanelApiUrl(), app: 'admin-app' });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocaleProvider>
      <ApolloProvider client={client}>
        <AuthProvider>
          <BrowserRouter>
            <App />
            <Toaster />
          </BrowserRouter>
        </AuthProvider>
      </ApolloProvider>
    </LocaleProvider>
  </React.StrictMode>
);