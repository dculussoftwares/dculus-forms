import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import path from 'path';
import { CustomWorld } from './world';

// Set step timeout based on backend type (local vs remote)
const isRemoteBackend = process.env.TEST_BASE_URL && !process.env.TEST_BASE_URL.includes('localhost');
setDefaultTimeout(isRemoteBackend ? 30000 : 10000); // 30s for remote, 10s for local

let backendProcess: ChildProcess;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const waitForServer = async (url: string, maxAttempts = 60, interval = 500): Promise<void> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await axios.get(url);
      console.log(`✅ Server is ready after ${attempt} attempts`);
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error(`Server did not start within ${maxAttempts * interval}ms`);
      }
      await sleep(interval);
    }
  }
};

BeforeAll(async function() {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:4000';
  const isRemoteBackend = process.env.TEST_BASE_URL && !process.env.TEST_BASE_URL.includes('localhost');

  if (isRemoteBackend) {
    console.log(`🌐 Using remote backend for integration tests: ${baseURL}`);
    // Just wait for remote server to be ready
    await waitForServer(`${baseURL}/health`);
  } else {
    console.log('🚀 Starting local backend server for integration tests...');

    const rootDir = path.resolve(process.cwd());

    // Start backend server with coverage if NODE_V8_COVERAGE is set
    const isCoverageMode = process.env.NODE_V8_COVERAGE;
    const backendCommand = isCoverageMode ? ['--filter', 'backend', 'dev:coverage'] : ['backend:dev'];

    backendProcess = spawn('pnpm', backendCommand, {
      cwd: rootDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: '4000',
        // Pass through coverage environment variable
        ...(isCoverageMode && { NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE })
      }
    });

    // Log server output for debugging
    backendProcess.stdout?.on('data', (data) => {
      console.log(`[Backend]: ${data.toString().trim()}`);
    });

    backendProcess.stderr?.on('data', (data) => {
      console.error(`[Backend Error]: ${data.toString().trim()}`);
    });

    // Wait for server to be ready
    await waitForServer(`${baseURL}/health`);
  }
});

// Clean up authentication data after each scenario
After(async function(this: CustomWorld) {
  if (typeof (this as any).cleanup === 'function') {
    await (this as any).cleanup();
  }
});

AfterAll(async function() {
  const isRemoteBackend = process.env.TEST_BASE_URL && !process.env.TEST_BASE_URL.includes('localhost');

  if (!isRemoteBackend && backendProcess) {
    console.log('🛑 Stopping local backend server...');

    backendProcess.kill('SIGTERM');

    // Wait a moment for graceful shutdown
    await sleep(2000);

    // Force kill if still running
    if (!backendProcess.killed) {
      backendProcess.kill('SIGKILL');
    }
  } else if (isRemoteBackend) {
    console.log('🌐 Remote backend testing completed');
  }
});