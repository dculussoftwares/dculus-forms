import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emailHandler } from '../handler.js';
import type { PluginEvent, PluginContext } from '../../core/types.js';
import type { ValidatedEmailConfig } from '../types.js';

// Mock dependencies. FillableFormField/TextInputField are kept REAL (via importOriginal) — the
// handler's digest-table builder does `field instanceof FillableFormField`, which needs the
// genuine class, not a mock stub.
vi.mock('@dculus/types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dculus/types')>();
  return {
    ...actual,
    deserializeFormSchema: vi.fn(),
  };
});

vi.mock('@dculus/utils', async (importOriginal) => {
  // parseEmailList is pure and the handler depends on its real behavior — keep the actual impl.
  const actual = await importOriginal<typeof import('@dculus/utils')>();
  return {
    ...actual,
    substituteMentions: vi.fn(),
    createFieldLabelsMap: vi.fn(),
  };
});

vi.mock('../../../services/pdfTemplateService.js', () => ({
  resolveResponsePdfAttachment: vi.fn(),
}));

vi.mock('../../../subscriptions/usageService.js', () => ({
  checkUsageExceeded: vi.fn(),
  getRemainingEmailQuota: vi.fn(),
}));

vi.mock('../../../subscriptions/events.js', () => ({
  emitEmailSent: vi.fn(),
}));

import { deserializeFormSchema } from '@dculus/types';
import { substituteMentions, createFieldLabelsMap } from '@dculus/utils';
import { resolveResponsePdfAttachment } from '../../../services/pdfTemplateService.js';
import { checkUsageExceeded, getRemainingEmailQuota } from '../../../subscriptions/usageService.js';

describe('Email Handler', () => {
  let mockContext: PluginContext;
  let mockLogger: any;
  let mockEvent: PluginEvent;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(checkUsageExceeded).mockResolvedValue({
      viewsExceeded: false,
      submissionsExceeded: false,
      emailsExceeded: false,
    });
    vi.mocked(getRemainingEmailQuota).mockResolvedValue({ remaining: null, exceeded: false });

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    // Mock plugin context
    mockContext = {
      logger: mockLogger,
      getFormById: vi.fn(),
      getResponseById: vi.fn(),
      getResponsesByFormId: vi.fn(),
      getOrganization: vi.fn(),
      getUserById: vi.fn(),
      sendEmail: vi.fn(),
      updatePluginConfig: vi.fn(),
      prisma: { pdfTemplate: { findUnique: vi.fn() } } as any,
    };

    // Mock event
    mockEvent = {
      type: 'form.submitted',
      formId: 'form-123',
      organizationId: 'org-123',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      data: {
        responseId: 'response-123',
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Successful email delivery', () => {
    it('should send email with correct recipient and subject', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'New Form Submission',
        message: '<p>You have a new form submission!</p>',
      };

      const mockForm = {
        id: 'form-123',
        formSchema: { pages: [] },
      };

      const mockResponse = {
        id: 'response-123',
        data: { name: 'John Doe', email: 'john@example.com' },
      };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({ name: 'Full Name', email: 'Email' });
      vi.mocked(substituteMentions).mockReturnValue('<p>You have a new form submission!</p>');
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith({
        to: 'admin@example.com',
        subject: 'New Form Submission',
        html: '<p>You have a new form submission!</p>',
      });

      expect(result.success).toBe(true);
      expect(result.recipient).toBe('admin@example.com');
      expect(result.subject).toBe('New Form Submission');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Email plugin triggered',
        expect.objectContaining({
          recipient: 'admin@example.com',
          eventType: 'form.submitted',
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Email sent successfully',
        expect.objectContaining({
          recipient: 'admin@example.com',
          subject: 'New Form Submission',
        })
      );
    });

    it('should substitute @ mentions with response values', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'New submission from @name',
        message: '<p>Name: @name</p><p>Email: @email</p>',
      };

      const mockForm = {
        id: 'form-123',
        formSchema: {
          pages: [
            {
              fields: [
                { id: 'name', type: 'text_input_field', label: 'Full Name' },
                { id: 'email', type: 'email_field', label: 'Email' },
              ],
            },
          ],
        },
      };

      const mockResponse = {
        id: 'response-123',
        data: { name: 'Jane Smith', email: 'jane@example.com' },
      };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue(mockForm.formSchema as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({
        name: 'Full Name',
        email: 'Email',
      });
      vi.mocked(substituteMentions).mockReturnValue(
        '<p>Name: Jane Smith</p><p>Email: jane@example.com</p>'
      );
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(substituteMentions).toHaveBeenCalledWith(
        '<p>Name: @name</p><p>Email: @email</p>',
        { name: 'Jane Smith', email: 'jane@example.com' },
        { name: 'Full Name', email: 'Email' }
      );

      expect(mockContext.sendEmail).toHaveBeenCalledWith({
        to: 'admin@example.com',
        subject: 'New submission from @name',
        html: '<p>Name: Jane Smith</p><p>Email: jane@example.com</p>',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Mentions substituted in email',
        expect.objectContaining({
          originalLength: expect.any(Number),
          substitutedLength: expect.any(Number),
        })
      );

      expect(result.success).toBe(true);
    });

    it('should handle email with HTML formatting', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Styled Email',
        message: '<div style="color: blue;"><h1>Title</h1><p>Content</p></div>',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = { id: 'response-123', data: {} };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({});
      vi.mocked(substituteMentions).mockReturnValue(config.message);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<div style="color: blue;"><h1>Title</h1><p>Content</p></div>',
        })
      );
    });
  });

  describe('Test event handling', () => {
    it('should add test banner for plugin.test events', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Test Email',
        message: '<p>This is a test message</p>',
      };

      const testEvent: PluginEvent = {
        type: 'plugin.test',
        formId: 'form-123',
        organizationId: 'org-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        data: {},
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      await emailHandler({ id: 'test-plugin', config }, testEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('🧪 Test Email'),
        })
      );

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('This is a test email from your plugin'),
        })
      );

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('<p>This is a test message</p>'),
        })
      );
    });

    it('should not substitute mentions for test events', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Test Email',
        message: '<p>Name: @name</p>',
      };

      const testEvent: PluginEvent = {
        type: 'plugin.test',
        formId: 'form-123',
        organizationId: 'org-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        data: {},
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      await emailHandler({ id: 'test-plugin', config }, testEvent, mockContext);

      expect(substituteMentions).not.toHaveBeenCalled();
      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('<p>Name: @name</p>'),
        })
      );
    });
  });

  describe('Schedule automation digest (#automations-digest)', () => {
    it('does NOT show the test banner on a real schedule-triggered run with no responseId — regression for the bug where every schedule email was mislabeled as a test send', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Weekly digest',
        message: '<p>You have {{__digestCount}} new responses.</p>',
      };

      // A real schedule automation run: event.type is 'schedule' (not 'plugin.test'), and
      // event.data.responseId is absent by design (triggerService.ts's handleScheduledTick)
      // — {{__digestCount}} has already been substituted by the engine's
      // substituteConfigMentions() before this handler runs, so config.message arrives with
      // the real number, not the placeholder.
      const scheduleEvent: PluginEvent = {
        type: 'schedule',
        formId: 'form-123',
        organizationId: 'org-123',
        timestamp: new Date('2026-01-01T09:00:00Z'),
        data: { __digestCount: 3, __digestSince: '2025-12-25T00:00:00Z', __digestUntil: '2026-01-01T09:00:00Z' },
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      await emailHandler(
        { id: 'test-plugin', config: { ...config, message: '<p>You have 3 new responses.</p>' } },
        scheduleEvent,
        mockContext
      );

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ html: expect.not.stringContaining('🧪 Test Email') })
      );
      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ html: expect.stringContaining('<p>You have 3 new responses.</p>') })
      );
    });

    it('appends a response table when includeDigestTable is true and __digestResponses is present', async () => {
      const { TextInputField, TextFieldValidation } = await vi.importActual<typeof import('@dculus/types')>(
        '@dculus/types'
      );

      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Weekly digest',
        message: '<p>New responses below.</p>',
        includeDigestTable: true,
      };

      const nameField = new TextInputField(
        'field-name',
        'Full Name',
        '',
        '',
        '',
        '',
        new TextFieldValidation(false)
      );

      const scheduleEvent: PluginEvent = {
        type: 'schedule',
        formId: 'form-123',
        organizationId: 'org-123',
        timestamp: new Date('2026-01-01T09:00:00Z'),
        data: {
          __digestResponses: [
            { id: 'r1', submittedAt: '2025-12-26T10:00:00.000Z', data: { 'field-name': 'Ada Lovelace' } },
            { id: 'r2', submittedAt: '2025-12-27T11:00:00.000Z', data: { 'field-name': 'Grace Hopper' } },
          ],
        },
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [{ fields: [nameField] }] } };
      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [{ fields: [nameField] }] } as any);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      await emailHandler({ id: 'test-plugin', config }, scheduleEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('<table'),
        })
      );
      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ html: expect.stringContaining('Ada Lovelace') })
      );
      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ html: expect.stringContaining('Grace Hopper') })
      );
      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ html: expect.stringContaining('Full Name') })
      );
    });

    it('caps the email table at 100 rows and adds a truncation note, independent of the digest node\'s own (up to 1000) cap', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Weekly digest',
        message: '<p>New responses below.</p>',
        includeDigestTable: true,
      };

      const manyResponses = Array.from({ length: 150 }, (_, i) => ({
        id: `r${i}`,
        submittedAt: '2025-12-26T10:00:00.000Z',
        data: { name: `Person ${i}` },
      }));

      const scheduleEvent: PluginEvent = {
        type: 'schedule',
        formId: 'form-123',
        organizationId: 'org-123',
        timestamp: new Date('2026-01-01T09:00:00Z'),
        data: { __digestResponses: manyResponses },
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      await emailHandler({ id: 'test-plugin', config }, scheduleEvent, mockContext);

      const sentHtml = vi.mocked(mockContext.sendEmail).mock.calls[0][0].html;
      expect((sentHtml.match(/Person \d+/g) ?? []).length).toBe(100);
      expect(sentHtml).toContain('Showing the first 100 of 150 responses.');
    });

    it('does NOT append a response table when includeDigestTable is false, even with __digestResponses present', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Weekly digest',
        message: '<p>New responses below.</p>',
        includeDigestTable: false,
      };

      const scheduleEvent: PluginEvent = {
        type: 'schedule',
        formId: 'form-123',
        organizationId: 'org-123',
        timestamp: new Date('2026-01-01T09:00:00Z'),
        data: {
          __digestResponses: [{ id: 'r1', submittedAt: '2025-12-26T10:00:00.000Z', data: { name: 'Ada' } }],
        },
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      await emailHandler({ id: 'test-plugin', config }, scheduleEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ html: expect.not.stringContaining('<table') })
      );
    });

    it('does not crash and omits the table when includeDigestTable is true but __digestResponses is absent', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Reminder',
        message: '<p>Please fill out the form.</p>',
        includeDigestTable: true,
      };

      const scheduleEvent: PluginEvent = {
        type: 'schedule',
        formId: 'form-123',
        organizationId: 'org-123',
        timestamp: new Date('2026-01-01T09:00:00Z'),
        data: {},
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      const result = await emailHandler({ id: 'test-plugin', config }, scheduleEvent, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ html: expect.not.stringContaining('<table') })
      );
    });
  });

  describe('Per-response digest send (#automations-digest-per-response)', () => {
    const scheduleEventWithDigest = (digestResponses: unknown[]): PluginEvent => ({
      type: 'schedule',
      formId: 'form-123',
      organizationId: 'org-123',
      timestamp: new Date('2026-01-01T09:00:00Z'),
      data: { __digestResponses: digestResponses },
    });

    beforeEach(() => {
      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);
    });

    // The batch has no per-response delivery record, so a throw escaping mid-loop fails the
    // pg-boss job and the retry restarts from the FIRST response — everyone already emailed gets
    // a second copy. Every failure must therefore stay isolated to its own response, including
    // ones raised before the send (mention substitution, recipient resolution).
    it('isolates a mid-batch throw to its own response instead of failing the whole batch', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientFieldId: 'email-field',
        recipientFieldLabel: 'Email',
        subject: 'Reminder',
        message: 'Hi {{name}}',
      };

      // Throwing from substituteMentions, which runs *before* sendEmail — the send's own
      // try/catch would never see it.
      vi.mocked(substituteMentions).mockImplementation((_msg: string, data: Record<string, any>) => {
        if (data.name === 'Grace') throw new Error('malformed response data');
        return `Hi ${data.name}`;
      });

      const event = scheduleEventWithDigest([
        { id: 'r1', submittedAt: '2025-12-26T10:00:00.000Z', data: { name: 'Ada', 'email-field': 'ada@example.com' } },
        { id: 'r2', submittedAt: '2025-12-27T11:00:00.000Z', data: { name: 'Grace', 'email-field': 'grace@example.com' } },
        { id: 'r3', submittedAt: '2025-12-28T11:00:00.000Z', data: { name: 'Alan', 'email-field': 'alan@example.com' } },
      ]);

      const result = await emailHandler({ id: 'test-plugin', config }, event, mockContext);

      // The batch ran to completion: the one bad response is counted, the others still delivered.
      expect(result.sentCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(mockContext.sendEmail).toHaveBeenCalledTimes(2);
      expect(mockContext.sendEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: 'alan@example.com' }));
    });

    it('sends one email per response, each to that response\'s own recipientFieldId value with substituted content', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientFieldId: 'email-field',
        recipientFieldLabel: 'Email',
        subject: 'Reminder',
        message: 'Hi {{name}}, thanks for submitting!',
      };

      vi.mocked(substituteMentions).mockImplementation((msg: string, data: Record<string, any>) =>
        msg.replace('{{name}}', data.name ?? '')
      );

      const event = scheduleEventWithDigest([
        { id: 'r1', submittedAt: '2025-12-26T10:00:00.000Z', data: { name: 'Ada', 'email-field': 'ada@example.com' } },
        { id: 'r2', submittedAt: '2025-12-27T11:00:00.000Z', data: { name: 'Grace', 'email-field': 'grace@example.com' } },
      ]);

      const result = await emailHandler({ id: 'test-plugin', config }, event, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledTimes(2);
      expect(mockContext.sendEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({
        to: 'ada@example.com',
        html: 'Hi Ada, thanks for submitting!',
      }));
      expect(mockContext.sendEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({
        to: 'grace@example.com',
        html: 'Hi Grace, thanks for submitting!',
      }));
      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it('skips (not fails) a response whose recipient field is empty, and still sends to the rest', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientFieldId: 'email-field',
        subject: 'Reminder',
        message: 'Hi',
      };
      vi.mocked(substituteMentions).mockImplementation((msg: string) => msg);

      const event = scheduleEventWithDigest([
        { id: 'r1', submittedAt: '2025-12-26T10:00:00.000Z', data: { 'email-field': '' } },
        { id: 'r2', submittedAt: '2025-12-27T11:00:00.000Z', data: { 'email-field': 'grace@example.com' } },
      ]);

      const result = await emailHandler({ id: 'test-plugin', config }, event, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledTimes(1);
      expect(mockContext.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'grace@example.com' }));
      expect(result.sentCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });

    it('counts (not throws on) a per-response send failure, continuing with the remaining responses', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientFieldId: 'email-field',
        subject: 'Reminder',
        message: 'Hi',
      };
      vi.mocked(substituteMentions).mockImplementation((msg: string) => msg);
      vi.mocked(mockContext.sendEmail)
        .mockRejectedValueOnce(new Error('SMTP timeout'))
        .mockResolvedValueOnce(undefined);

      const event = scheduleEventWithDigest([
        { id: 'r1', submittedAt: '2025-12-26T10:00:00.000Z', data: { 'email-field': 'ada@example.com' } },
        { id: 'r2', submittedAt: '2025-12-27T11:00:00.000Z', data: { 'email-field': 'grace@example.com' } },
      ]);

      // Must not throw — a thrown error here would fail the whole pg-boss job and retry the
      // entire step, re-sending to responses that already succeeded (no per-response idempotency).
      const result = await emailHandler({ id: 'test-plugin', config }, event, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(false);
      expect(result.sentCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.error).toContain('SMTP timeout');
    });

    it('skips the entire batch (zero sends) when the org has exceeded its email usage limit', async () => {
      vi.mocked(getRemainingEmailQuota).mockResolvedValue({ remaining: 0, exceeded: true });

      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientFieldId: 'email-field',
        subject: 'Reminder',
        message: 'Hi',
      };
      const event = scheduleEventWithDigest([
        { id: 'r1', submittedAt: '2025-12-26T10:00:00.000Z', data: { 'email-field': 'ada@example.com' } },
      ]);

      const result = await emailHandler({ id: 'test-plugin', config }, event, mockContext);

      expect(mockContext.sendEmail).not.toHaveBeenCalled();
      expect(result.skipped).toBe(true);
      expect(result.skippedCount).toBe(1);
    });

    it('caps sends at the reserved quota mid-batch and skips the rest, instead of overshooting the plan limit', async () => {
      vi.mocked(getRemainingEmailQuota).mockResolvedValue({ remaining: 1, exceeded: false });

      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientFieldId: 'email-field',
        subject: 'Reminder',
        message: 'Hi',
      };
      const event = scheduleEventWithDigest([
        { id: 'r1', submittedAt: '2025-12-26T10:00:00.000Z', data: { 'email-field': 'ada@example.com' } },
        { id: 'r2', submittedAt: '2025-12-27T11:00:00.000Z', data: { 'email-field': 'grace@example.com' } },
        { id: 'r3', submittedAt: '2025-12-28T12:00:00.000Z', data: { 'email-field': 'alan@example.com' } },
      ]);

      const result = await emailHandler({ id: 'test-plugin', config }, event, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledTimes(1);
      expect(result.sentCount).toBe(1);
      expect(result.skippedCount).toBe(2);
    });

    it('succeeds with sentCount 0 when the digest batch is empty (nothing new to send to)', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientFieldId: 'email-field',
        subject: 'Reminder',
        message: 'Hi',
      };
      const event = scheduleEventWithDigest([]);

      const result = await emailHandler({ id: 'test-plugin', config }, event, mockContext);

      expect(mockContext.sendEmail).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(0);
    });

    it('does NOT use the per-response path when recipientFieldId is absent (aggregate/static mode, unaffected)', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'ops@example.com',
        subject: 'Digest',
        message: '3 new responses',
      };
      const event = scheduleEventWithDigest([
        { id: 'r1', submittedAt: '2025-12-26T10:00:00.000Z', data: { name: 'Ada' } },
      ]);

      const result = await emailHandler({ id: 'test-plugin', config }, event, mockContext);

      // Aggregate path: exactly one send, to the static address, not one per digest response.
      expect(mockContext.sendEmail).toHaveBeenCalledTimes(1);
      expect(mockContext.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ops@example.com' }));
      expect(result.sentCount).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should throw error when form not found', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Test',
        message: '<p>Test</p>',
      };

      vi.mocked(mockContext.getFormById).mockResolvedValue(null);

      await expect(
        emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext)
      ).rejects.toThrow('Email sending failed: Form not found: form-123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Email sending failed',
        expect.objectContaining({
          recipient: 'admin@example.com',
          error: 'Form not found: form-123',
        })
      );
    });

    it('should throw error when email sending fails', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Test',
        message: '<p>Test</p>',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = { id: 'response-123', data: {} };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({});
      vi.mocked(substituteMentions).mockReturnValue('<p>Test</p>');
      vi.mocked(mockContext.sendEmail).mockRejectedValue(
        new Error('SMTP connection failed')
      );

      await expect(
        emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext)
      ).rejects.toThrow('Email sending failed: SMTP connection failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Email sending failed',
        expect.objectContaining({
          error: 'SMTP connection failed',
        })
      );
    });

    it('should handle response not found gracefully', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Test',
        message: '<p>Message with @mention</p>',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(null);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      // Should not substitute mentions when response is null
      await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(substituteMentions).not.toHaveBeenCalled();
    });

    it('should handle response with null data', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Test',
        message: '<p>Message with @mention</p>',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = { id: 'response-123', data: null };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      // Should not substitute mentions when data is null
      await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(substituteMentions).not.toHaveBeenCalled();
    });
  });

  describe('Form schema and field labels', () => {
    it('should extract field labels from form schema for mentions', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Test',
        message: '<p>@field1 @field2</p>',
      };

      const mockForm = {
        id: 'form-123',
        formSchema: {
          pages: [
            {
              fields: [
                { id: 'field1', type: 'text_input_field', label: 'First Field' },
                { id: 'field2', type: 'email_field', label: 'Second Field' },
              ],
            },
          ],
        },
      };

      const mockResponse = {
        id: 'response-123',
        data: { field1: 'Value 1', field2: 'Value 2' },
      };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue(mockForm.formSchema as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({
        field1: 'First Field',
        field2: 'Second Field',
      });
      vi.mocked(substituteMentions).mockReturnValue('<p>Value 1 Value 2</p>');
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(deserializeFormSchema).toHaveBeenCalledWith(mockForm.formSchema);
      expect(createFieldLabelsMap).toHaveBeenCalledWith(mockForm.formSchema);
      expect(substituteMentions).toHaveBeenCalledWith(
        '<p>@field1 @field2</p>',
        { field1: 'Value 1', field2: 'Value 2' },
        { field1: 'First Field', field2: 'Second Field' }
      );
    });

    it('should handle empty field labels map', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Test',
        message: '<p>No mentions here</p>',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = { id: 'response-123', data: {} };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({});
      vi.mocked(substituteMentions).mockReturnValue('<p>No mentions here</p>');
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(createFieldLabelsMap).toHaveBeenCalledWith({ pages: [] });
      expect(substituteMentions).toHaveBeenCalledWith(
        '<p>No mentions here</p>',
        {},
        {}
      );
    });
  });

  describe('Field-based recipient', () => {
    it('should resolve recipient from a form email field', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientFieldId: 'email-field',
        recipientFieldLabel: 'Contact Email',
        subject: 'New Form Submission',
        message: '<p>You have a new form submission!</p>',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = {
        id: 'response-123',
        data: { 'email-field': 'respondent@example.com' },
      };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({});
      vi.mocked(substituteMentions).mockReturnValue(config.message);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'respondent@example.com' })
      );
      expect(result.success).toBe(true);
      expect(result.recipient).toBe('respondent@example.com');
    });

    it('should send to both static and field-based recipients, deduped', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        recipientFieldId: 'email-field',
        recipientFieldLabel: 'Contact Email',
        subject: 'New Form Submission',
        message: '<p>You have a new form submission!</p>',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = {
        id: 'response-123',
        data: { 'email-field': 'respondent@example.com' },
      };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({});
      vi.mocked(substituteMentions).mockReturnValue(config.message);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'admin@example.com, respondent@example.com' })
      );
      expect(result.recipient).toBe('admin@example.com, respondent@example.com');
    });

    it('should not duplicate recipient when static and field-based emails match', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'same@example.com',
        recipientFieldId: 'email-field',
        subject: 'New Form Submission',
        message: '<p>Hi</p>',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = {
        id: 'response-123',
        data: { 'email-field': 'same@example.com' },
      };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({});
      vi.mocked(substituteMentions).mockReturnValue(config.message);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'same@example.com' })
      );
      expect(result.recipient).toBe('same@example.com');
    });

    it('should send to every address in a comma-separated static recipient list', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'ops@example.com, lead@example.com; owner@example.com',
        subject: 'Weekly summary',
        message: '<p>Here is this week\'s digest.</p>',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = { id: 'response-123', data: {} };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({});
      vi.mocked(substituteMentions).mockReturnValue(config.message);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'ops@example.com, lead@example.com, owner@example.com' })
      );
      expect(result.recipient).toBe('ops@example.com, lead@example.com, owner@example.com');
    });

    it('should de-dupe a static list against the field recipient case-insensitively', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'ops@example.com, lead@example.com',
        recipientFieldId: 'email-field',
        subject: 'New Form Submission',
        message: '<p>Hi</p>',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = {
        id: 'response-123',
        data: { 'email-field': 'Lead@Example.com' },
      };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({});
      vi.mocked(substituteMentions).mockReturnValue(config.message);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'ops@example.com, lead@example.com' })
      );
      expect(result.recipient).toBe('ops@example.com, lead@example.com');
    });

    it('should skip sending (not throw) when the field-based recipient is empty on this submission', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientFieldId: 'email-field',
        recipientFieldLabel: 'Contact Email',
        subject: 'New Form Submission',
        message: '<p>Hi</p>',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = {
        id: 'response-123',
        data: { 'email-field': '' },
      };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(mockContext.sendEmail).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('Contact Email');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Email skipped: no recipient could be resolved',
        expect.objectContaining({ reason: expect.stringContaining('Contact Email') })
      );
    });

    it('should skip sending during a plugin.test event when only a field-based recipient is configured', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientFieldId: 'email-field',
        recipientFieldLabel: 'Contact Email',
        subject: 'Test Email',
        message: '<p>Hi</p>',
      };

      const testEvent: PluginEvent = {
        type: 'plugin.test',
        formId: 'form-123',
        organizationId: 'org-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        data: {},
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);

      const result = await emailHandler({ id: 'test-plugin', config }, testEvent, mockContext);

      expect(mockContext.getResponseById).not.toHaveBeenCalled();
      expect(mockContext.sendEmail).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty message', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Empty Message',
        message: '',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = { id: 'response-123', data: {} };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({});
      vi.mocked(substituteMentions).mockReturnValue('');
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '',
        })
      );
    });

    it('should handle very long messages', async () => {
      const longMessage = '<p>' + 'A'.repeat(10000) + '</p>';
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Long Message',
        message: longMessage,
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = { id: 'response-123', data: {} };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({});
      vi.mocked(substituteMentions).mockReturnValue(longMessage);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle special characters in email content', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Special <chars> & "quotes"',
        message: '<p>Special &lt;chars&gt; &amp; &quot;quotes&quot;</p>',
      };

      const mockForm = { id: 'form-123', formSchema: { pages: [] } };
      const mockResponse = { id: 'response-123', data: {} };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({});
      vi.mocked(substituteMentions).mockReturnValue(config.message);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.subject).toBe('Special <chars> & "quotes"');
    });

    it('should handle multiple @ mentions in same message', async () => {
      const config: ValidatedEmailConfig = {
        type: 'email',
        recipientEmail: 'admin@example.com',
        subject: 'Multiple Mentions',
        message: '<p>@name submitted @email with score @score</p>',
      };

      const mockForm = {
        id: 'form-123',
        formSchema: { pages: [] },
      };

      const mockResponse = {
        id: 'response-123',
        data: { name: 'John', email: 'john@test.com', score: '95' },
      };

      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({
        name: 'Name',
        email: 'Email',
        score: 'Score',
      });
      vi.mocked(substituteMentions).mockReturnValue(
        '<p>John submitted john@test.com with score 95</p>'
      );
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);

      await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(substituteMentions).toHaveBeenCalledWith(
        '<p>@name submitted @email with score @score</p>',
        { name: 'John', email: 'john@test.com', score: '95' },
        { name: 'Name', email: 'Email', score: 'Score' }
      );
    });
  });

  describe('PDF attachment', () => {
    const config: ValidatedEmailConfig = {
      type: 'email',
      recipientEmail: 'admin@example.com',
      subject: 'New Form Submission',
      message: '<p>You have a new form submission!</p>',
      attachPdfTemplateId: 'template-123',
      attachPdfTemplateName: 'Confirmation Letter',
    };

    const mockForm = { id: 'form-123', formSchema: { pages: [] } };
    const mockResponse = { id: 'response-123', data: { name: 'John Doe' } };

    beforeEach(() => {
      vi.mocked(mockContext.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
      vi.mocked(createFieldLabelsMap).mockReturnValue({});
      vi.mocked(substituteMentions).mockReturnValue(config.message);
      vi.mocked(mockContext.sendEmail).mockResolvedValue(undefined);
    });

    it('renders and attaches the configured PDF template', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 fake');
      vi.mocked(resolveResponsePdfAttachment).mockResolvedValue({
        attachment: {
          filename: 'confirmation-letter-response-123.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      });

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(resolveResponsePdfAttachment).toHaveBeenCalledWith(mockContext.prisma, {
        pdfTemplateId: 'template-123',
        formId: 'form-123',
        responseId: 'response-123',
        deserializedSchema: { pages: [] },
        responseData: mockResponse.data,
      });
      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            {
              filename: 'confirmation-letter-response-123.pdf',
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        })
      );
      expect(result.attachedPdfFilename).toBe('confirmation-letter-response-123.pdf');
      expect(result.attachmentError).toBeUndefined();
      expect(result.success).toBe(true);
    });

    it('sends the email without an attachment when the template no longer exists', async () => {
      vi.mocked(resolveResponsePdfAttachment).mockResolvedValue({
        error: 'PDF template "template-123" no longer exists',
      });

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ attachments: undefined })
      );
      expect(result.success).toBe(true);
      expect(result.attachedPdfFilename).toBeUndefined();
      expect(result.attachmentError).toContain('Confirmation Letter');
      expect(result.attachmentError).toContain('no longer exists');
    });

    it('rejects a template belonging to a different form (cross-form config)', async () => {
      // resolveResponsePdfAttachment itself owns the cross-form guard (see
      // pdfTemplateService.test.ts); the handler only needs to trust its result.
      vi.mocked(resolveResponsePdfAttachment).mockResolvedValue({
        error: 'PDF template "template-123" no longer exists',
      });

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ attachments: undefined })
      );
      expect(result.success).toBe(true);
      expect(result.attachedPdfFilename).toBeUndefined();
      expect(result.attachmentError).toContain('Confirmation Letter');
    });

    it('sends the email without an attachment when PDF generation fails', async () => {
      vi.mocked(resolveResponsePdfAttachment).mockResolvedValue({
        error: 'pdfme render failed',
      });

      const result = await emailHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ attachments: undefined })
      );
      expect(result.success).toBe(true);
      expect(result.attachmentError).toContain('pdfme render failed');
    });

    it('skips attachment generation for test events with no response data', async () => {
      const testEvent: PluginEvent = {
        type: 'plugin.test',
        formId: 'form-123',
        organizationId: 'org-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        data: {},
      };
      vi.mocked(mockContext.getResponseById).mockResolvedValue(null as any);

      const result = await emailHandler({ id: 'test-plugin', config }, testEvent, mockContext);

      expect(resolveResponsePdfAttachment).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.attachedPdfFilename).toBeUndefined();
    });
  });
});
