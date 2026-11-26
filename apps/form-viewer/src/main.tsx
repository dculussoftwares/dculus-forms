import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { getRuntimeConfig, initOpenPanel } from '@dculus/utils'
import { getOpenPanelApiUrl, getOpenPanelClientId } from './lib/config'
import './index.css'
import App from './App.tsx'

const sentryDsn = getRuntimeConfig('VITE_SENTRY_DSN', import.meta.env.VITE_SENTRY_DSN)
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  })
}

// Product analytics (no-op without VITE_OPENPANEL_CLIENT_ID).
initOpenPanel({ clientId: getOpenPanelClientId(), apiUrl: getOpenPanelApiUrl(), app: 'form-viewer' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
