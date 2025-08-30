import { Before, After, BeforeAll, AfterAll, Status } from '@cucumber/cucumber';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { Browser, chromium } from 'playwright';
import { E2EWorld } from './world';
import { HealthCheckUtils } from '../utils/health-check-utils';

const healthCheck = new HealthCheckUtils();
let backendProcess: ChildProcess;
let frontendProcess: ChildProcess;

// Shared browser instance for optimization
let sharedBrowser: Browser | undefined;
let authStorageState: string | undefined;
const storageStatePath = path.join(__dirname, '../reports/auth-state.json');

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const waitForServer = async (url: string, maxAttempts = 60, interval = 2000): Promise<void> => {
  console.log(`⏳ Waiting for server at ${url}...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(url, { 
        timeout: 5000,
        validateStatus: () => true // Accept any HTTP status
      });
      
      if (response.status < 500) {
        console.log(`✅ Server at ${url} is ready after ${attempt} attempts`);
        return;
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error(`❌ Server at ${url} did not start within ${maxAttempts * interval}ms`);
        throw new Error(`Server did not start within ${maxAttempts * interval}ms`);
      }
      console.log(`   Attempt ${attempt}/${maxAttempts} failed, retrying...`);
      await sleep(interval);
    }
  }
};

const isPortInUse = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const testServer = require('net').createServer();
    testServer.listen(port, () => {
      testServer.once('close', () => resolve(false));
      testServer.close();
    });
    testServer.on('error', () => resolve(true));
  });
};

// Create shared authentication state once for all scenarios
const createSharedAuthenticationState = async (): Promise<void> => {
  if (!sharedBrowser) {
    throw new Error('Shared browser not initialized');
  }
  
  console.log('🔐 Creating shared authentication state...');
  
  // Create temporary context for authentication
  const tempContext = await sharedBrowser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });
  
  const tempPage = await tempContext.newPage();
  tempPage.setDefaultTimeout(30000);
  tempPage.setDefaultNavigationTimeout(30000);
  
  try {
    // Generate test credentials
    const testEmail = `shared-test-user-${Date.now()}@example.com`;
    const testOrganization = `Shared Test Org ${Date.now()}`;
    const testPassword = 'TestPassword123!';
    
    // Get the actual frontend URL (could be on different port)
    const frontendUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
    
    // Navigate to sign up page
    await tempPage.goto(`${frontendUrl}/signup`, { waitUntil: 'networkidle' });
    
    // Fill registration form
    await tempPage.locator('#name').fill('Shared Test User');
    await tempPage.locator('#email').fill(testEmail);
    await tempPage.locator('#organizationName').fill(testOrganization);
    await tempPage.locator('#password').fill(testPassword);
    await tempPage.locator('#confirmPassword').fill(testPassword);
    
    // Submit registration
    await tempPage.locator('button:has-text(\"Create account\")').click();
    await tempPage.waitForTimeout(3000);
    
    // Navigate to sign in page
    await tempPage.goto(`${frontendUrl}/signin`, { waitUntil: 'networkidle' });
    
    // Sign in
    await tempPage.locator('#email').fill(testEmail);
    await tempPage.locator('#password').fill(testPassword);
    await tempPage.locator('button:has-text(\"Sign in\")').click();
    
    // Wait for successful signin and verify dashboard
    await tempPage.waitForTimeout(2000);
    await tempPage.waitForLoadState('networkidle');
    
    // Verify we're on dashboard
    const currentUrl = tempPage.url();
    if (currentUrl.includes('/signin')) {
      throw new Error('Failed to authenticate - still on signin page');
    }
    
    // Save authentication state
    await tempContext.storageState({ path: storageStatePath });
    authStorageState = storageStatePath;
    
    console.log('✅ Shared authentication state created and saved');
    console.log(`📧 Test user email: ${testEmail}`);
    
  } catch (error) {
    console.error('❌ Failed to create shared authentication state:', error);
    throw error;
  } finally {
    await tempContext.close();
  }
};

// Global setup - start services and shared browser
BeforeAll({ timeout: 120000 }, async function () {
  console.log('🚀 Starting E2E test suite with auto-service management...');
  
  const rootDir = path.resolve(process.cwd());
  
  // Initialize shared browser instance
  console.log('🌐 Initializing shared browser instance...');
  sharedBrowser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    slowMo: process.env.PLAYWRIGHT_SLOW_MO ? parseInt(process.env.PLAYWRIGHT_SLOW_MO) : 0,
  });
  console.log('✅ Shared browser initialized');
  
  // Check if services are already running
  const backendInUse = await isPortInUse(4000);
  const frontendInUse = await isPortInUse(3000);
  
  // Start backend if not already running
  if (!backendInUse) {
    console.log('🔧 Starting backend server automatically...');
    backendProcess = spawn('pnpm', ['backend:dev'], {
      cwd: rootDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: '4000'
      }
    });

    // Log backend output for debugging (but limit noise)
    let backendReady = false;
    backendProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output.includes('Server running') || !backendReady) {
        console.log(`[Backend]: ${output}`);
        if (output.includes('Server running')) {
          backendReady = true;
        }
      }
    });

    backendProcess.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      // Filter out expected noisy logs
      if (!output.includes('deprecated') && 
          !output.includes('Authentication required') &&
          !output.includes('GraphQL Error')) {
        console.error(`[Backend Error]: ${output}`);
      }
    });
  } else {
    console.log('ℹ️  Backend already running on port 4000');
  }
  
  // Start frontend if not already running  
  if (!frontendInUse) {
    console.log('⚛️  Starting frontend server automatically...');
    frontendProcess = spawn('pnpm', ['form-app:dev'], {
      cwd: rootDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: '3000'
      }
    });

    // Log frontend output for debugging (but limit noise)
    let frontendReady = false;
    frontendProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output.includes('Local:') || output.includes('ready') || !frontendReady) {
        console.log(`[Frontend]: ${output}`);
        if (output.includes('Local:') || output.includes('ready')) {
          frontendReady = true;
        }
      }
    });

    frontendProcess.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      if (!output.includes('deprecated') && !output.includes('CJS build')) { // Filter noise
        console.error(`[Frontend Error]: ${output}`);
      }
    });
  } else {
    console.log('ℹ️  Frontend already running on port 3000');  
  }

  // Wait for both services to be ready
  try {
    await waitForServer('http://localhost:4000/health');
    await waitForServer('http://localhost:3000');
    console.log('✅ All services are ready for testing');
  } catch (error) {
    console.error('❌ Failed to start services:', error);
    throw error;
  }
  
  // Authentication state will be created per scenario but with shared browser
  console.log('✅ Shared browser ready for scenarios (authentication per scenario)');
});

// Before each scenario - initialize browser context with shared authentication
Before(async function (this: E2EWorld, scenario) {
  const scenarioName = scenario.pickle?.name || 'Unknown scenario';
  console.log(`🎬 Starting scenario: "${scenarioName}"`);
  
  // Store scenario info in world for later use
  this.pickle = scenario.pickle;
  
  // Initialize browser context with shared browser (no auth state initially)
  await this.initializeBrowserWithSharedAuth(sharedBrowser);
  
  console.log('✅ Browser context initialized with shared authentication');
});

// After each scenario - cleanup and take screenshot on failure
After(async function (this: E2EWorld, scenario) {
  const scenarioName = this.pickle?.name || scenario.pickle?.name || 'unknown-scenario';
  console.log(`🎭 Finishing scenario: ${scenarioName}`);
  
  // Take screenshot on failure
  if (scenario.result?.status === Status.FAILED) {
    console.log('❌ Scenario failed, taking screenshot...');
    try {
      const screenshotName = `failed-${scenarioName.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;
      await this.takeScreenshot(screenshotName);
      console.log(`📸 Screenshot saved: ${screenshotName}.png`);
    } catch (error) {
      console.log('⚠️ Failed to take screenshot:', error);
    }
  }
  
  // Cleanup browser resources
  await this.cleanup();
  
  console.log('✅ Scenario cleanup completed');
});

// Global teardown - stop services we started  
AfterAll({ timeout: 30000 }, async function () {
  console.log('🏁 E2E test suite completed');
  
  // Stop frontend process if we started it
  if (frontendProcess && !frontendProcess.killed) {
    console.log('🛑 Stopping frontend server...');
    try {
      frontendProcess.kill('SIGTERM');
      await sleep(2000); // Shorter wait
      
      // Force kill if still running
      if (!frontendProcess.killed) {
        frontendProcess.kill('SIGKILL');
        await sleep(500);
      }
    } catch (error) {
      console.log('ℹ️  Frontend process already terminated');
    }
  }
  
  // Stop backend process if we started it
  if (backendProcess && !backendProcess.killed) {
    console.log('🛑 Stopping backend server...');
    try {
      backendProcess.kill('SIGTERM');
      await sleep(1000); // Shorter wait
      
      // Force kill if still running  
      if (!backendProcess.killed) {
        backendProcess.kill('SIGKILL');
        await sleep(500);
      }
    } catch (error) {
      console.log('ℹ️  Backend process already terminated');
    }
  }
  
  console.log('✅ Service cleanup completed');
  
  // Close shared browser instance
  if (sharedBrowser) {
    console.log('🌐 Closing shared browser instance...');
    try {
      await sharedBrowser.close();
      console.log('✅ Shared browser closed');
    } catch (error) {
      console.log('⚠️ Error closing shared browser:', error);
    }
  }
  
  // Clean up authentication state file
  if (fs.existsSync(storageStatePath)) {
    try {
      fs.unlinkSync(storageStatePath);
      console.log('🗑️ Authentication state file cleaned up');
    } catch (error) {
      console.log('⚠️ Error cleaning up auth state file:', error);
    }
  }
});