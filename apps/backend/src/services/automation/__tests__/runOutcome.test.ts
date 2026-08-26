import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordRunOutcome, AUTO_PAUSE_AFTER_FAILURES } from '../runOutcome.js';
import { automationRepository } from '../../../repositories/index.js';
import { sendAutomationFailureEmail } from '../../emailService.js';
import { unscheduleAutomationCron } from '../cronSchedule.js';
import { prisma } from '../../../lib/prisma.js';

vi.mock('../../../repositories/index.js', () => ({
  automationRepository: { updateAutomation: vi.fn() },
}));
vi.mock('../../emailService.js', () => ({ sendAutomationFailureEmail: vi.fn() }));
vi.mock('../cronSchedule.js', () => ({ unscheduleAutomationCron: vi.fn() }));
vi.mock('../../../lib/prisma.js', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));

/** The automation as it looks *after* the outcome write, which is what recordRunOutcome reads. */
function updatedAutomation(overrides: Record<string, any> = {}) {
  return {
    id: 'automation-1',
    name: 'Welcome flow',
    formId: 'form-1',
    createdBy: 'user-1',
    status: 'ACTIVE',
    triggerType: 'form.submitted',
    consecutiveFailureCount: 0,
    ...overrides,
  };
}

describe('recordRunOutcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: 'owner@example.com',
      name: 'Ada',
    } as any);
  });

  it('records the outcome on the automation so the list can badge it without loading run history', async () => {
    vi.mocked(automationRepository.updateAutomation).mockResolvedValue(updatedAutomation() as any);

    await recordRunOutcome('automation-1', 'run-1', 'COMPLETED');

    expect(automationRepository.updateAutomation).toHaveBeenCalledWith(
      'automation-1',
      expect.objectContaining({ lastRunStatus: 'COMPLETED', lastRunAt: expect.any(Date) })
    );
  });

  it('resets the failure streak on a clean run', async () => {
    vi.mocked(automationRepository.updateAutomation).mockResolvedValue(updatedAutomation() as any);

    await recordRunOutcome('automation-1', 'run-1', 'COMPLETED');

    expect(automationRepository.updateAutomation).toHaveBeenCalledWith(
      'automation-1',
      expect.objectContaining({ consecutiveFailureCount: 0 })
    );
    expect(sendAutomationFailureEmail).not.toHaveBeenCalled();
  });

  it('emails the owner on the first failure of a streak', async () => {
    vi.mocked(automationRepository.updateAutomation).mockResolvedValue(
      updatedAutomation({ consecutiveFailureCount: 1 }) as any
    );

    await recordRunOutcome('automation-1', 'run-9', 'FAILED');

    expect(automationRepository.updateAutomation).toHaveBeenCalledWith(
      'automation-1',
      expect.objectContaining({ consecutiveFailureCount: { increment: 1 } })
    );
    expect(sendAutomationFailureEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        automationName: 'Welcome flow',
        runId: 'run-9',
        reason: 'first-failure',
      })
    );
  });

  // The counter is its own debounce — a broken integration must not mail the owner every tick.
  it('stays quiet on subsequent failures in the same streak', async () => {
    vi.mocked(automationRepository.updateAutomation).mockResolvedValue(
      updatedAutomation({ consecutiveFailureCount: 3 }) as any
    );

    await recordRunOutcome('automation-1', 'run-9', 'FAILED');

    expect(sendAutomationFailureEmail).not.toHaveBeenCalled();
    expect(unscheduleAutomationCron).not.toHaveBeenCalled();
  });

  it('pauses the automation and notifies once the streak proves it is broken', async () => {
    vi.mocked(automationRepository.updateAutomation).mockResolvedValue(
      updatedAutomation({ consecutiveFailureCount: AUTO_PAUSE_AFTER_FAILURES, triggerType: 'schedule' }) as any
    );

    await recordRunOutcome('automation-1', 'run-9', 'FAILED');

    expect(automationRepository.updateAutomation).toHaveBeenCalledWith(
      'automation-1',
      expect.objectContaining({ status: 'PAUSED' })
    );
    // A paused schedule automation must also stop ticking, or it keeps creating runs that the
    // action nodes then cancel.
    expect(unscheduleAutomationCron).toHaveBeenCalledWith('automation-1');
    expect(sendAutomationFailureEmail).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'auto-paused' })
    );
  });

  it('does not re-pause an automation that is already paused', async () => {
    vi.mocked(automationRepository.updateAutomation).mockResolvedValue(
      updatedAutomation({ consecutiveFailureCount: AUTO_PAUSE_AFTER_FAILURES, status: 'PAUSED' }) as any
    );

    await recordRunOutcome('automation-1', 'run-9', 'FAILED');

    expect(automationRepository.updateAutomation).not.toHaveBeenCalledWith(
      'automation-1',
      expect.objectContaining({ status: 'PAUSED' })
    );
  });

  // CANCELLED and SKIPPED are user-initiated or benign — neither evidence of health nor breakage.
  it.each(['CANCELLED', 'SKIPPED'])(
    'records %s without touching the failure streak',
    async (status) => {
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue(updatedAutomation() as any);

      await recordRunOutcome('automation-1', 'run-1', status);

      const [, data] = vi.mocked(automationRepository.updateAutomation).mock.calls[0];
      expect(data).not.toHaveProperty('consecutiveFailureCount');
      expect(sendAutomationFailureEmail).not.toHaveBeenCalled();
    }
  );

  // The counter means "failures IN A ROW". Leaving PARTIAL neutral would let
  // FAILED,FAILED,FAILED,PARTIAL,FAILED,FAILED reach five and auto-pause an automation that never
  // failed five times consecutively.
  it('breaks the failure streak on a partly-delivered run', async () => {
    vi.mocked(automationRepository.updateAutomation).mockResolvedValue(updatedAutomation() as any);

    await recordRunOutcome('automation-1', 'run-1', 'PARTIAL');

    expect(automationRepository.updateAutomation).toHaveBeenCalledWith(
      'automation-1',
      expect.objectContaining({ lastRunStatus: 'PARTIAL', consecutiveFailureCount: 0 })
    );
    // Still not worth mailing about: something did get delivered.
    expect(sendAutomationFailureEmail).not.toHaveBeenCalled();
  });

  // Bookkeeping must never be able to fail the run that triggered it.
  it('swallows its own errors rather than failing the run', async () => {
    vi.mocked(automationRepository.updateAutomation).mockRejectedValue(new Error('db down'));

    await expect(recordRunOutcome('automation-1', 'run-1', 'FAILED')).resolves.toBeUndefined();
  });

  it('skips the email when the owner has no address on record', async () => {
    vi.mocked(automationRepository.updateAutomation).mockResolvedValue(
      updatedAutomation({ consecutiveFailureCount: 1 }) as any
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);

    await expect(recordRunOutcome('automation-1', 'run-1', 'FAILED')).resolves.toBeUndefined();
    expect(sendAutomationFailureEmail).not.toHaveBeenCalled();
  });
});
