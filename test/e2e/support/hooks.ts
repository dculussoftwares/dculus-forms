import { Before, After, BeforeAll, AfterAll, Status } from '@cucumber/cucumber';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import path from 'path';
import { E2EWorld } from './world';
import { HealthCheckUtils } from '../utils/health-check-utils';

const healthCheck = new HealthCheckUtils();
let backendProcess: ChildProcess;
let frontendProcess: ChildProcess;

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

// Global setup - start services automatically
BeforeAll(async function () {
  console.log('🚀 Starting E2E test suite with auto-service management...');
  
  const rootDir = path.resolve(process.cwd());
  
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
});

// Before each scenario - initialize browser
Before(async function (this: E2EWorld, scenario) {
  const scenarioName = scenario.pickle?.name || 'Unknown scenario';
  console.log(`🎬 Starting scenario: "${scenarioName}"`);
  
  // Store scenario info in world for later use
  this.pickle = scenario.pickle;
  
  // Initialize browser and page
  await this.initializeBrowser();
  
  console.log('✅ Browser initialized for scenario');
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
});