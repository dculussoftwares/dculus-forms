import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import path from 'path';
import { CustomWorld } from './world';

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
  console.log('🚀 Starting backend server for integration tests...');
  
  const rootDir = path.resolve(process.cwd());
  
  // Start backend server
  backendProcess = spawn('pnpm', ['backend:dev'], {
    cwd: rootDir,
    stdio: 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '4000'
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
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:4000';
  await waitForServer(`${baseURL}/health`);
});

// Clean up authentication data after each scenario
After(async function(this: CustomWorld) {
  if (typeof (this as any).cleanup === 'function') {
    await (this as any).cleanup();
  }
});

AfterAll(async function() {
  console.log('🛑 Stopping backend server...');
  
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    
    // Wait a moment for graceful shutdown
    await sleep(2000);
    
    // Force kill if still running
    if (!backendProcess.killed) {
      backendProcess.kill('SIGKILL');
    }
  }
});