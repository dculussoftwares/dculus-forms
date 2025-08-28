import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './features',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Video on failure */
    video: 'retain-on-failure',
    /* Run in headless mode unless specified otherwise */
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Increase timeout for slow CI environments
        actionTimeout: 10000,
        navigationTimeout: 15000,
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.E2E_SKIP_WEBSERVER ? undefined : [
    {
      command: 'pnpm docker:up',
      timeout: 30000,
      reuseExistingServer: true,
    },
    {
      command: 'pnpm backend:dev',
      port: 4000,
      timeout: 60000,
      reuseExistingServer: true,
    },
    {
      command: 'pnpm form-app:dev',
      port: 3000,
      timeout: 60000,
      reuseExistingServer: true,
    },
  ],
});