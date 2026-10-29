import { describe, it, expect, vi, beforeEach } from 'vitest';

const { emitter, prismaMock, generateSingle } = await vi.hoisted(async () => ({
  emitter: new (await import('node:events')).EventEmitter(),
  prismaMock: {
    pdfGenerator: { findMany: vi.fn() },
    pdfGenerationRun: { create: vi.fn(), update: vi.fn() },
  },
  generateSingle: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../../services/responseFilterService.js', () => ({
  applyResponseFilters: vi.fn((rows: unknown[]) => rows),
}));
vi.mock('../../../services/pdfGenerationJobService.js', () => ({
  generateSinglePdfForGenerator: generateSingle,
}));
vi.mock('../events.js', () => ({ getEventEmitter: () => emitter }));

import {
  initializePdfGeneratorAutoRun,
  allowAutoRun,
  resetAutoRunLimits,
  AUTO_RUN_MAX_CONCURRENT,
  AUTO_RUN_MAX_PER_FORM_PER_MINUTE,
} from '../pdfGeneratorAutoRun.js';

const submit = (formId: string, responseId: string) =>
  emitter.emit('plugin:event', { type: 'form.submitted', formId, organizationId: 'o', data: { responseId } });
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('PDF generator auto-run limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAutoRunLimits();
    emitter.removeAllListeners();
    initializePdfGeneratorAutoRun();
    prismaMock.pdfGenerator.findMany.mockResolvedValue([{ id: 'g1', filters: [], filterLogic: 'AND' }]);
    prismaMock.pdfGenerationRun.create.mockResolvedValue({ id: 'run-1' });
    prismaMock.pdfGenerationRun.update.mockResolvedValue({});
    generateSingle.mockResolvedValue(undefined);
  });

  it('allows up to the per-form limit within a minute, then refuses, and resets after the window', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < AUTO_RUN_MAX_PER_FORM_PER_MINUTE; i++) expect(allowAutoRun('f', t0)).toBe(true);
    expect(allowAutoRun('f', t0 + 1)).toBe(false);
    expect(allowAutoRun('other', t0)).toBe(true);
    expect(allowAutoRun('f', t0 + 60_001)).toBe(true);
  });

  it('skips generation for submissions over the per-form limit', async () => {
    for (let i = 0; i < AUTO_RUN_MAX_PER_FORM_PER_MINUTE + 5; i++) submit('f', `r${i}`);
    await flush();
    expect(generateSingle).toHaveBeenCalledTimes(AUTO_RUN_MAX_PER_FORM_PER_MINUTE);
  });

  it('never renders more than the concurrency cap at once', async () => {
    let running = 0;
    let peak = 0;
    generateSingle.mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
    });
    for (let i = 0; i < 10; i++) submit(`f${i}`, `r${i}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(generateSingle).toHaveBeenCalledTimes(10);
    expect(peak).toBeLessThanOrEqual(AUTO_RUN_MAX_CONCURRENT);
  });
});
