import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { pathToFileURL } from 'url';
// The backend's Prisma client is generated via the `prisma-client` generator
// (see apps/backend/prisma/schema.prisma) into apps/backend/src/generated/prisma
// rather than the default @prisma/client output, and it requires a driver
// adapter to connect (no built-in query engine). It's also emitted as an ES
// module (apps/backend has "type": "module"), so it can't be `require()`'d
// from this CommonJS test project — it's loaded via dynamic `import()` in
// the BeforeAll hook below. Only the type is imported statically here
// (fully erased at runtime, so the ESM/CJS mismatch doesn't apply).
import type { PrismaClient } from '../../../apps/backend/src/generated/prisma/client.js' with { 'resolution-mode': 'import' };
import { PrismaPg } from '@prisma/adapter-pg';
import { CustomWorld } from './world';
import { MockSMTPServer } from '../utils/mock-servers';
import { getMockS3Service, MockS3Service } from '../utils/s3-mock';

// Set step timeout based on backend type (local vs remote)
const isRemoteBackend = process.env.TEST_BASE_URL && !process.env.TEST_BASE_URL.includes('localhost');
setDefaultTimeout(isRemoteBackend ? 30000 : 10000); // 30s for remote, 10s for local

let backendProcess: ChildProcess;
let prisma: PrismaClient;
let mockSMTPServer: MockSMTPServer;
let mockS3: MockS3Service;
const shouldManageDocker = process.env.MANAGE_INTEGRATION_DOCKER !== 'false';
console.log(
  `⚙️  Integration Docker management: ${shouldManageDocker ? 'auto' : 'external'} (MANAGE_INTEGRATION_DOCKER=${
    process.env.MANAGE_INTEGRATION_DOCKER ?? 'undefined'
  })`
);
let startedDockerPostgres = false;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const dockerComposeFile = path.resolve(process.cwd(), 'test/integration/docker-compose.postgres.yml');

type DockerComposeCommand = {
  command: string;
  args: string[];
};

const detectDockerComposeCommand = (): DockerComposeCommand => {
  const override = process.env.DOCKER_COMPOSE_CMD;
  if (override) {
    const [command, ...args] = override.split(' ');
    return { command, args };
  }

  const tryDockerCompose = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
  if (!tryDockerCompose.error && tryDockerCompose.status === 0) {
    return { command: 'docker', args: ['compose'] };
  }

  const tryLegacyCompose = spawnSync('docker-compose', ['--version'], { stdio: 'ignore' });
  if (!tryLegacyCompose.error && tryLegacyCompose.status === 0) {
    return { command: 'docker-compose', args: [] };
  }

  throw new Error('Neither `docker compose` nor `docker-compose` commands are available.');
};

const dockerComposeCommand = detectDockerComposeCommand();

const runDockerCompose = (args: string[]) => {
  if (!fs.existsSync(dockerComposeFile)) {
    throw new Error(`docker-compose.yml not found at ${dockerComposeFile}`);
  }

  const result = spawnSync(dockerComposeCommand.command, [...dockerComposeCommand.args, '--file', dockerComposeFile, ...args], {
    stdio: 'inherit',
  });

  if (result.error || result.status !== 0) {
    throw result.error || new Error(`docker compose ${args.join(' ')} failed with code ${result.status}`);
  }
};

const startDockerPostgres = () => {
  if (startedDockerPostgres) {
    return;
  }

  console.log('🐳 Ensuring PostgreSQL Docker container is running for integration tests...');
  runDockerCompose(['up', '-d', 'postgres']);
  startedDockerPostgres = true;
};

const stopDockerPostgres = () => {
  if (!startedDockerPostgres) {
    return;
  }

  console.log('🐳 Stopping PostgreSQL Docker container used for integration tests...');
  try {
    runDockerCompose(['stop', 'postgres']);
    runDockerCompose(['rm', '-f', 'postgres']);
  } catch (error) {
    console.error('Failed to stop PostgreSQL Docker container', error);
  } finally {
    startedDockerPostgres = false;
  }
};

const connectPrismaWithRetry = async (client: PrismaClient, maxAttempts = 30, delayMs = 1000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await client.$connect();
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      console.log(`⏳ Waiting for PostgreSQL to become ready (attempt ${attempt}/${maxAttempts})...`);
      await sleep(delayMs);
    }
  }
};

const waitForPostgresPort = async (postgresUri: string, maxAttempts = 30, delayMs = 1000) => {
  const url = new URL(postgresUri);
  const host = url.hostname || '127.0.0.1';
  const port = Number(url.port || 5432);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isReachable = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve(true);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
    });

    if (isReachable) {
      return;
    }

    console.log(`⏳ Waiting for PostgreSQL port ${host}:${port} (attempt ${attempt}/${maxAttempts})...`);
    await sleep(delayMs);
  }

  throw new Error(`PostgreSQL is not reachable at ${host}:${port}`);
};

// Helper to clean PostgreSQL database
const cleanDatabase = async (prismaClient: PrismaClient) => {
  // Delete in correct order to respect foreign keys
  const tables = [
    'response_field_change',
    'response_edit_history',
    'form_submission_analytics',
    'form_view_analytics',
    'response',
    'form_permission',
    'form_plugin',
    'form_file',
    'collaborative_document',
    'form_metadata',
    'form',
    'form_template',
    'external_plugin',
    'verification',
    'session',
    'account',
    'member',
    'invitation',
    'organization',
    'user',
  ];

  for (const table of tables) {
    try {
      await prismaClient.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch (error) {
      // Table might not exist or already empty, continue
      console.log(`  Skipping ${table}`);
    }
  }
};

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
    if (shouldManageDocker) {
      startDockerPostgres();
    } else {
      console.log('ℹ️ Skipping Docker start (managed externally via MANAGE_INTEGRATION_DOCKER=false)');
    }

    console.log('🗄️  Using PostgreSQL database for integration tests...');

    const rootDir = path.resolve(process.cwd());

    // Use existing PostgreSQL database (from env) or integration Docker container
    const postgresUri =
      process.env.DATABASE_URL ||
      'postgresql://dculus:dculus_dev_password@127.0.0.1:5543/dculus_forms?sslmode=disable&gssencmode=disable';
    console.log(`✅ Using PostgreSQL at: ${postgresUri.replace(/:[^:]*@/, ':****@')}`);

    // Ensure PostgreSQL is reachable before connecting via Prisma
    await waitForPostgresPort(postgresUri);
    console.log('✅ PostgreSQL port reachable');

    // Initialize Prisma client with PostgreSQL, using the same driver-adapter
    // pattern as apps/backend/src/lib/prisma.ts (the generated client requires
    // an adapter — it has no built-in query engine). Loaded via dynamic
    // import() from the *compiled* backend dist output — the generated
    // client is an ES module (apps/backend has "type": "module") and this
    // test project is CommonJS, and Node's native import() cannot load raw
    // .ts source. This requires `pnpm --filter backend build` to have run
    // first (see test/integration/README.md).
    const backendClientDist = path.resolve(
      rootDir,
      'apps/backend/dist/apps/backend/src/generated/prisma/client.js'
    );
    if (!fs.existsSync(backendClientDist)) {
      throw new Error(
        `Backend Prisma client not found at ${backendClientDist}. Run "pnpm --filter backend build" before running integration tests.`
      );
    }
    const { PrismaClient: BackendPrismaClient } = await import(pathToFileURL(backendClientDist).href);
    prisma = new BackendPrismaClient({
      adapter: new PrismaPg({ connectionString: postgresUri }),
    }) as PrismaClient;

    await connectPrismaWithRetry(prisma);
    console.log('✅ Prisma client connected to PostgreSQL');

    // Clean database before tests
    console.log('🧹 Cleaning test database...');
    await cleanDatabase(prisma);
    console.log('✅ Test database cleaned');

    // Start Mock SMTP Server
    console.log('📧 Starting Mock SMTP Server for integration tests...');
    mockSMTPServer = new MockSMTPServer();
    await mockSMTPServer.start(1025);

    // Initialize Mock S3 Service
    console.log('📦 Initializing Mock S3 Service for integration tests...');
    mockS3 = getMockS3Service();
    console.log('✅ Mock S3 Service initialized');

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
        // Use PostgreSQL for local tests
        DATABASE_URL: postgresUri,
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

// Clean up authentication data and mock S3 after each scenario
After(async function(this: CustomWorld) {
  if (typeof (this as any).cleanup === 'function') {
    await (this as any).cleanup();
  }

  // Clear mock S3 storage between scenarios
  const isRemoteBackend = process.env.TEST_BASE_URL && !process.env.TEST_BASE_URL.includes('localhost');
  if (!isRemoteBackend && mockS3) {
    mockS3.clear();
  }
});

AfterAll(async function() {
  const isRemoteBackend = process.env.TEST_BASE_URL && !process.env.TEST_BASE_URL.includes('localhost');

  if (!isRemoteBackend) {
    if (backendProcess) {
      console.log('🛑 Stopping local backend server...');

      backendProcess.kill('SIGTERM');

      // Wait a moment for graceful shutdown
      await sleep(2000);

      // Force kill if still running
      if (!backendProcess.killed) {
        backendProcess.kill('SIGKILL');
      }
    }

    // Cleanup Mock SMTP Server
    if (mockSMTPServer) {
      console.log('📧 Stopping Mock SMTP Server...');
      await mockSMTPServer.stop();
    }

    // Cleanup Prisma
    if (prisma) {
      console.log('🗄️  Disconnecting Prisma client...');
      await prisma.$disconnect();
    }

    if (shouldManageDocker) {
      stopDockerPostgres();
    } else {
      console.log('ℹ️ Skipping Docker stop (managed externally via MANAGE_INTEGRATION_DOCKER=false)');
    }
  } else {
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

// Export mock S3 service for use in World and step definitions
export function getMockS3(): MockS3Service {
  if (!mockS3) {
    throw new Error('Mock S3 Service not initialized. BeforeAll hook must run first.');
  }
  return mockS3;
}
