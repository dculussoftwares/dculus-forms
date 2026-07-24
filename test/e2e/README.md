# End-to-end tests (Cucumber + Playwright)

This directory holds Cucumber scenarios that drive Playwright to exercise the
form-app UI. The suite currently covers the email/password sign-in flow and
creating a form from a template.

## Setup
- Install deps: `pnpm install`
- Install Playwright browsers: `pnpm exec playwright install --with-deps`
- Start the app the tests should hit (defaults assume `pnpm dev` with form-app
  on http://localhost:5173).

## Running
- `pnpm test:e2e`
- Optional env vars:
  - `E2E_BASE_URL` (default: http://localhost:5173)
  - `E2E_EMAIL` and `E2E_PASSWORD` (required)
  - `E2E_HEADLESS=false` to see the browser locally

Artifacts from failures (traces/screenshots/videos) are written to
`test-results/e2e` and are git-ignored.

## Automations (`@automations`)

`pnpm test:e2e --tags "@automations"` runs the linear automation happy path:
build a webhook action in the builder, confirm Activate is blocked while it's
unconfigured, activate it, submit the public form, and poll the runs view for
the run to reach `COMPLETED` with a `SUCCESS` step.

- The backend must be started with `DIRECT_URL` set — that's what enables the
  pg-boss automation engine (`initializeAutomationEngine()` degrades to
  disabled without it). CI's `e2e-local` job already sets `DIRECT_URL` for the
  same Postgres instance as `DATABASE_URL`, so no CI change was needed here.
- The webhook action's URL field only accepts `https://` (client-side
  validation in `WebhookConfigForm`), so this scenario points it at Postman's
  public echo endpoint (`https://postman-echo.com/post`), which always
  responds `200`, rather than standing up a local capture server — a
  self-hosted target would need a self-signed cert plus
  `NODE_TLS_REJECT_UNAUTHORIZED=0` on the backend process, which weakens TLS
  verification for every outbound call the backend makes for the life of that
  process. The scenario only asserts run/step status, not delivered payload
  content.
