import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emailHandler } from '../handler.js';
import type { PluginEvent, PluginContext } from '../../types.js';
import type { ValidatedEmailConfig } from '../types.js';

// Mock dependencies
vi.mock('@dculus/types', () => ({
  deserializeFormSchema: vi.fn(),
}));

vi.mock('@dculus/utils', () => ({
  substituteMentions: vi.fn(),
  createFieldLabelsMap: vi.fn(),
}));

import { deserializeFormSchema } from '@dculus/types';
import { substituteMentions, createFieldLabelsMap } from '@dculus/utils';

describe('Email Handler', () => {
  let mockContext: PluginContext;
  let mockLogger: any;
  let mockEvent: PluginEvent;

  beforeEach(() => {
    vi.clearAllMocks();

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
      prisma: {} as any,
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

      const result = await emailHandler({ config }, mockEvent, mockContext);

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

      const result = await emailHandler({ config }, mockEvent, mockContext);

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

      await emailHandler({ config }, mockEvent, mockContext);

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

      await emailHandler({ config }, testEvent, mockContext);

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

      await emailHandler({ config }, testEvent, mockContext);

      expect(substituteMentions).not.toHaveBeenCalled();
      expect(mockContext.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('<p>Name: @name</p>'),
        })
      );
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
        emailHandler({ config }, mockEvent, mockContext)
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
        emailHandler({ config }, mockEvent, mockContext)
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
      await emailHandler({ config }, mockEvent, mockContext);

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
      await emailHandler({ config }, mockEvent, mockContext);

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

      await emailHandler({ config }, mockEvent, mockContext);

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

      await emailHandler({ config }, mockEvent, mockContext);

      expect(createFieldLabelsMap).toHaveBeenCalledWith({ pages: [] });
      expect(substituteMentions).toHaveBeenCalledWith(
        '<p>No mentions here</p>',
        {},
        {}
      );
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

      const result = await emailHandler({ config }, mockEvent, mockContext);

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

      const result = await emailHandler({ config }, mockEvent, mockContext);

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

      const result = await emailHandler({ config }, mockEvent, mockContext);

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

      await emailHandler({ config }, mockEvent, mockContext);

      expect(substituteMentions).toHaveBeenCalledWith(
        '<p>@name submitted @email with score @score</p>',
        { name: 'John', email: 'john@test.com', score: '95' },
        { name: 'Name', email: 'Email', score: 'Score' }
      );
    });
  });
});
