import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config();

/**
 * Playwright config for CI - assumes servers are already running
 */
export default defineConfig({
  testDir: '../e2e',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: '../playwright-report' }],
    ['junit', { outputFile: '../test-results/junit-results.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot settings */
    screenshot: 'only-on-failure',

    /* Video settings */
    video: 'retain-on-failure',

    /* Wait for 30000ms for actions */
    actionTimeout: 30000,

    /* Wait for 30000ms for navigation/load events */
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },
  ],

  /* Global setup and teardown */
  globalSetup: './test-setup.ts',

  /* Timeout settings */
  timeout: 60000,
  expect: {
    timeout: 10000,
  },

  /* Output directories */
  outputDir: '../test-results/',
});