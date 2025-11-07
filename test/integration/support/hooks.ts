import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import path from 'path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { PrismaClient } from '@prisma/client';
import { CustomWorld } from './world';
import { MockSMTPServer } from '../utils/mock-servers';

// Set step timeout based on backend type (local vs remote)
const isRemoteBackend = process.env.TEST_BASE_URL && !process.env.TEST_BASE_URL.includes('localhost');
setDefaultTimeout(isRemoteBackend ? 30000 : 10000); // 30s for remote, 10s for local

let backendProcess: ChildProcess;
let mongoServer: MongoMemoryReplSet;
let prisma: PrismaClient;
let mockSMTPServer: MockSMTPServer;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const waitForServer = async (url: string, maxAttempts = 90, interval = 1000): Promise<void> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await axios.get(url);
      console.log(`✅ Server is ready after ${attempt} attempts`);
      // Give it a bit more time to fully initialize after health check passes
      await sleep(2000);
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error(`Server did not start within ${maxAttempts * interval}ms`);
      }
      await sleep(interval);
    }
  }
};

BeforeAll({ timeout: 120000 }, async function() {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:4000';
  const isRemoteBackend = process.env.TEST_BASE_URL && !process.env.TEST_BASE_URL.includes('localhost');

  if (isRemoteBackend) {
    console.log(`🌐 Using remote backend for integration tests: ${baseURL}`);
    // Just wait for remote server to be ready
    await waitForServer(`${baseURL}/health`);
  } else {
    console.log('🗄️  Starting MongoDB Memory Server for integration tests...');

    const rootDir = path.resolve(process.cwd());

    // Start MongoDB Memory Replica Set (required for Prisma transactions)
    mongoServer = await MongoMemoryReplSet.create({
      replSet: {
        count: 1,  // Single node replica set
        dbName: 'integration_test_db',
        storageEngine: 'wiredTiger',
      },
    });

    // Get URI and add database name properly (before query params)
    const baseUri = mongoServer.getUri();
    const mongoUri = baseUri.replace('/?', '/integration_test_db?');
    console.log(`✅ MongoDB Memory Server started at ${mongoUri}`);

    // Initialize Prisma client with in-memory MongoDB
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: mongoUri,
        },
      },
    });

    await prisma.$connect();
    console.log('✅ Prisma client connected to MongoDB Memory Server');

    // Push schema to MongoDB Memory Server
    console.log('🔨 Pushing Prisma schema to in-memory database...');
    const { spawn: syncSpawn } = await import('child_process');
    const backendDir = path.join(rootDir, 'apps', 'backend');
    const pushSchemaProcess = syncSpawn('npx', ['prisma', 'db', 'push', '--skip-generate'], {
      cwd: backendDir,
      env: {
        ...process.env,
        DATABASE_URL: mongoUri,
      },
      stdio: 'pipe',
    });

    // Wait for schema push to complete
    await new Promise<void>((resolve, reject) => {
      let output = '';
      pushSchemaProcess.stdout?.on('data', (data) => {
        output += data.toString();
        console.log(`[Schema Push]: ${data.toString().trim()}`);
      });
      pushSchemaProcess.stderr?.on('data', (data) => {
        output += data.toString();
        console.log(`[Schema Push]: ${data.toString().trim()}`);
      });
      pushSchemaProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Prisma schema pushed to MongoDB Memory Server');
          resolve();
        } else {
          console.error('❌ Failed to push Prisma schema');
          reject(new Error(`Schema push failed with code ${code}`));
        }
      });
    });

    // Start Mock SMTP Server
    console.log('📧 Starting Mock SMTP Server for integration tests...');
    mockSMTPServer = new MockSMTPServer();
    await mockSMTPServer.start(1025);

    console.log('🚀 Starting local backend server for integration tests...');

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
        // Use in-memory MongoDB for local tests
        DATABASE_URL: mongoUri,
        // Use Mock SMTP Server for emails
        EMAIL_HOST: 'localhost',
        EMAIL_PORT: '1025',
        EMAIL_USER: 'test',
        EMAIL_PASSWORD: 'test',
        EMAIL_FROM: 'noreply@test.com',
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

    // Cleanup Mock SMTP Server
    if (mockSMTPServer) {
      console.log('📧 Stopping Mock SMTP Server...');
      await mockSMTPServer.stop();
    }

    // Cleanup Prisma and MongoDB Memory Server
    if (prisma) {
      console.log('🗄️  Disconnecting Prisma client...');
      await prisma.$disconnect();
    }

    if (mongoServer) {
      console.log('🗄️  Stopping MongoDB Memory Server...');
      await mongoServer.stop();
      console.log('✅ MongoDB Memory Server stopped');
    }
  } else if (isRemoteBackend) {
    console.log('🌐 Remote backend testing completed');
  }
});

// Export prisma instance for use in World and step definitions
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    throw new Error('Prisma client not initialized. BeforeAll hook must run first.');
  }
  return prisma;
}

// Export mock SMTP server for use in World and step definitions
export function getMockSMTPServer(): MockSMTPServer {
  if (!mockSMTPServer) {
    throw new Error('Mock SMTP Server not initialized. BeforeAll hook must run first.');
  }
  return mockSMTPServer;
}