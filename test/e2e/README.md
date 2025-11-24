# End-to-end tests (Cucumber + Playwright)

This directory holds Cucumber scenarios that drive Playwright to exercise the
form-app UI. The suite currently covers the email/password sign-in flow.

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
