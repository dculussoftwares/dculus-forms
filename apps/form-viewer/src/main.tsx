import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { getRuntimeConfig } from '@dculus/utils'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
