import { describe, it, expect, beforeEach, vi } from 'vitest';

const infoMock = vi.fn();
const errorMock = vi.fn();
const warnMock = vi.fn();
const debugMock = vi.fn();
const childInfoMock = vi.fn();
const childErrorMock = vi.fn();
const childWarnMock = vi.fn();
const childDebugMock = vi.fn();
const childFactory = vi.fn(() => ({
  info: childInfoMock,
  error: childErrorMock,
  warn: childWarnMock,
  debug: childDebugMock,
}));

const mockPino = vi.fn(() => ({
  info: infoMock,
  error: errorMock,
  warn: warnMock,
  debug: debugMock,
  child: childFactory,
}));

(mockPino as any).stdTimeFunctions = { isoTime: vi.fn() };

vi.mock('pino', () => ({
  default: mockPino,
}));

const importLogger = async () => {
  vi.resetModules();
  return import('../logger.js');
};

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs info with single argument directly', async () => {
    const { logger } = await importLogger();

    logger.info('service ready');

    expect(infoMock).toHaveBeenCalledWith('service ready');
  });

  it('logs info with trailing context object', async () => {
    const { logger } = await importLogger();

    logger.info('Form created', 'successfully', { requestId: 'req-1' });

    expect(infoMock).toHaveBeenCalledWith({ requestId: 'req-1' }, 'Form created successfully');
  });

  it('logs error with Error instances as structured context', async () => {
    const { logger } = await importLogger();
    const err = new Error('boom');

    logger.error('Failed to save', err);

    expect(errorMock).toHaveBeenCalledWith({ err }, 'Failed to save');
  });

  it('logs warn messages by joining plain arguments', async () => {
    const { logger } = await importLogger();

    logger.warn('Cache miss for', 'form-123');

    expect(warnMock).toHaveBeenCalledWith('Cache miss for form-123');
  });

  it('creates child loggers with bound context', async () => {
    const { logger } = await importLogger();

    const child = logger.child({ service: 'forms' });
    child.info('processing', 'complete');
    child.error('failed');

    expect(childFactory).toHaveBeenCalledWith({ service: 'forms' });
    expect(childInfoMock).toHaveBeenCalledWith('processing complete');
    expect(childErrorMock).toHaveBeenCalledWith('failed');
  });
});
