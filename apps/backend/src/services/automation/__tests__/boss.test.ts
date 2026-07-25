import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PgBoss } from 'pg-boss';
import {
  isAutomationEngineEnabled,
  getBoss,
  startAutomationBoss,
  stopAutomationBoss,
  AUTOMATION_QUEUE,
  AUTOMATION_CRON_QUEUE,
  __resetBossForTests,
} from '../boss.js';
import { logger } from '../../../lib/logger.js';

vi.mock('pg-boss', () => {
  const PgBoss = vi.fn().mockImplementation(function (this: any, options: any) {
    this.options = options;
    this.on = vi.fn();
    this.start = vi.fn().mockResolvedValue(undefined);
    this.createQueue = vi.fn().mockResolvedValue(undefined);
    this.stop = vi.fn().mockResolvedValue(undefined);
  });
  return { PgBoss };
});

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('automation boss', () => {
  const originalDirectUrl = process.env.DIRECT_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetBossForTests();
  });

  afterEach(() => {
    if (originalDirectUrl === undefined) {
      delete process.env.DIRECT_URL;
    } else {
      process.env.DIRECT_URL = originalDirectUrl;
    }
  });

  describe('isAutomationEngineEnabled', () => {
    it('is false when DIRECT_URL is not set', () => {
      delete process.env.DIRECT_URL;
      expect(isAutomationEngineEnabled()).toBe(false);
    });

    it('is true when DIRECT_URL is set', () => {
      process.env.DIRECT_URL = 'postgres://direct/db';
      expect(isAutomationEngineEnabled()).toBe(true);
    });
  });

  describe('getBoss', () => {
    it('returns null when DIRECT_URL is not set', () => {
      delete process.env.DIRECT_URL;
      expect(getBoss()).toBeNull();
      expect(PgBoss).not.toHaveBeenCalled();
    });

    it('constructs pg-boss with the direct connection string and pgboss schema', () => {
      process.env.DIRECT_URL = 'postgres://direct/db';

      const boss = getBoss();

      expect(PgBoss).toHaveBeenCalledWith({
        connectionString: 'postgres://direct/db',
        schema: 'pgboss',
      });
      expect(boss).not.toBeNull();
    });

    it('memoizes the singleton across repeated calls', () => {
      process.env.DIRECT_URL = 'postgres://direct/db';

      const first = getBoss();
      const second = getBoss();

      expect(first).toBe(second);
      expect(PgBoss).toHaveBeenCalledTimes(1);
    });
  });

  describe('startAutomationBoss', () => {
    it('logs a warning and returns null when DIRECT_URL is not set', async () => {
      delete process.env.DIRECT_URL;

      const result = await startAutomationBoss();

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DIRECT_URL is not set')
      );
    });

    it('starts pg-boss and creates the automation-step queue', async () => {
      process.env.DIRECT_URL = 'postgres://direct/db';

      const result = await startAutomationBoss();

      expect(result).not.toBeNull();
      expect(result!.start).toHaveBeenCalledTimes(1);
      expect(result!.createQueue).toHaveBeenCalledWith(AUTOMATION_QUEUE);
    });

    it('also creates the automation-cron queue', async () => {
      process.env.DIRECT_URL = 'postgres://direct/db';

      const result = await startAutomationBoss();

      expect(result!.createQueue).toHaveBeenCalledWith(AUTOMATION_CRON_QUEUE);
    });
  });

  describe('stopAutomationBoss', () => {
    it('is a no-op when pg-boss was never started', async () => {
      delete process.env.DIRECT_URL;

      await expect(stopAutomationBoss()).resolves.toBeUndefined();
    });

    it('stops pg-boss and clears the singleton so the next getBoss constructs anew', async () => {
      process.env.DIRECT_URL = 'postgres://direct/db';

      await startAutomationBoss();
      const instance = getBoss();
      await stopAutomationBoss();

      expect(instance!.stop).toHaveBeenCalledTimes(1);
      expect(PgBoss).toHaveBeenCalledTimes(1);

      getBoss();
      expect(PgBoss).toHaveBeenCalledTimes(2);
    });
  });
});
