import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResponseEditTrackingService } from '../responseEditTrackingService.js';
import { FormSchema, ThemeType, SpacingType, PageModeType } from '@dculus/types';
import { responseRepository } from '../../repositories/index.js';
import { logger } from '../../lib/logger.js';

// Mock dependencies
vi.mock('../../repositories/index.js');
vi.mock('../hocuspocus.js', () => ({
  getFormSchemaFromHocuspocus: vi.fn(),
}));

describe('ResponseEditTrackingService', () => {
  const mockFormSchema: FormSchema = {
    pages: [
      {
        id: 'page-1',
        title: 'Page 1',
        order: 0,
        fields: [
          {
            id: 'field-1',
            type: 'text_input_field' as any,
            label: 'Name',
            defaultValue: '',
            prefix: '',
            hint: '',
            validation: { required: true, type: 'text_input_field' as any },
          },
          {
            id: 'field-2',
            type: 'email_field' as any,
            label: 'Email',
            defaultValue: '',
            prefix: '',
            hint: '',
            validation: { required: true, type: 'email_field' as any },
          },
        ],
      },
    ],
    layout: {
      theme: ThemeType.LIGHT,
      textColor: '#000000',
      spacing: SpacingType.NORMAL,
      code: 'L1' as const,
      content: '',
      customBackGroundColor: '#ffffff',
      backgroundImageKey: '',
      pageMode: PageModeType.MULTIPAGE,
    },
    isShuffleEnabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectChanges', () => {
    it('should detect added fields', () => {
      const oldData = {};
      const newData = { 'field-1': 'John Doe' };

      const changes = ResponseEditTrackingService.detectChanges(
        oldData,
        newData,
        mockFormSchema
      );

      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        fieldId: 'field-1',
        fieldLabel: 'Name',
        fieldType: 'text_input_field',
        previousValue: undefined,
        newValue: 'John Doe',
        changeType: 'ADD',
      });
    });

    it('should detect updated fields', () => {
      const oldData = { 'field-1': 'John Doe' };
      const newData = { 'field-1': 'Jane Smith' };

      const changes = ResponseEditTrackingService.detectChanges(
        oldData,
        newData,
        mockFormSchema
      );

      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        fieldId: 'field-1',
        changeType: 'UPDATE',
        previousValue: 'John Doe',
        newValue: 'Jane Smith',
      });
    });

    it('should detect deleted fields', () => {
      const oldData = { 'field-1': 'John Doe' };
      const newData = {};

      const changes = ResponseEditTrackingService.detectChanges(
        oldData,
        newData,
        mockFormSchema
      );

      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        fieldId: 'field-1',
        changeType: 'DELETE',
        previousValue: 'John Doe',
        newValue: undefined,
      });
    });

    it('should detect multiple changes', () => {
      const oldData = { 'field-1': 'John', 'field-2': 'old@example.com' };
      const newData = { 'field-1': 'Jane', 'field-2': 'new@example.com' };

      const changes = ResponseEditTrackingService.detectChanges(
        oldData,
        newData,
        mockFormSchema
      );

      expect(changes).toHaveLength(2);
    });

    it('should skip equivalent values', () => {
      const oldData = { 'field-1': 'John', 'field-2': 'test@example.com' };
      const newData = { 'field-1': 'John', 'field-2': 'test@example.com' };

      const changes = ResponseEditTrackingService.detectChanges(
        oldData,
        newData,
        mockFormSchema
      );

      expect(changes).toHaveLength(0);
    });

    it('should calculate value change size for text fields', () => {
      const oldData = { 'field-1': 'Short' };
      const newData = { 'field-1': 'This is a much longer text' };

      const changes = ResponseEditTrackingService.detectChanges(
        oldData,
        newData,
        mockFormSchema
      );

      expect(changes[0].valueChangeSize).toBeGreaterThan(0);
    });

    it('should handle unknown field types', () => {
      const oldData = { 'unknown-field': 'value1' };
      const newData = { 'unknown-field': 'value2' };

      const changes = ResponseEditTrackingService.detectChanges(
        oldData,
        newData,
        mockFormSchema
      );

      expect(changes[0]).toMatchObject({
        fieldId: 'unknown-field',
        fieldLabel: 'unknown-field',
        fieldType: 'unknown',
      });
    });

    it('should treat null and empty string as equivalent', () => {
      const oldData = { 'field-1': null };
      const newData = { 'field-1': '' };

      const changes = ResponseEditTrackingService.detectChanges(
        oldData,
        newData,
        mockFormSchema
      );

      expect(changes).toHaveLength(0);
    });

    it('should handle array values', () => {
      const oldData = { 'field-1': ['a', 'b'] };
      const newData = { 'field-1': ['a', 'b', 'c'] };

      const changes = ResponseEditTrackingService.detectChanges(
        oldData,
        newData,
        mockFormSchema
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('UPDATE');
    });

    it('should handle object values', () => {
      const oldData = { 'field-1': { name: 'John' } };
      const newData = { 'field-1': { name: 'Jane' } };

      const changes = ResponseEditTrackingService.detectChanges(
        oldData,
        newData,
        mockFormSchema
      );

      expect(changes).toHaveLength(1);
    });

    it('should trim whitespace when comparing strings', () => {
      const oldData = { 'field-1': '  John  ' };
      const newData = { 'field-1': 'John' };

      const changes = ResponseEditTrackingService.detectChanges(
        oldData,
        newData,
        mockFormSchema
      );

      expect(changes).toHaveLength(0);
    });
  });

  describe('createChangesSummary', () => {
    it('should return "No changes" for empty changes array', () => {
      const summary = ResponseEditTrackingService.createChangesSummary([]);

      expect(summary).toBe('No changes');
    });

    it('should summarize added fields', () => {
      const changes = [
        {
          fieldId: 'field-1',
          fieldLabel: 'Name',
          fieldType: 'text_input_field',
          previousValue: null,
          newValue: 'John',
          changeType: 'ADD' as const,
        },
      ];

      const summary = ResponseEditTrackingService.createChangesSummary(changes);

      expect(summary).toBe('Added 1 field');
    });

    it('should summarize multiple added fields', () => {
      const changes = [
        {
          fieldId: 'field-1',
          fieldLabel: 'Name',
          fieldType: 'text_input_field',
          previousValue: null,
          newValue: 'John',
          changeType: 'ADD' as const,
        },
        {
          fieldId: 'field-2',
          fieldLabel: 'Email',
          fieldType: 'email_field',
          previousValue: null,
          newValue: 'john@example.com',
          changeType: 'ADD' as const,
        },
      ];

      const summary = ResponseEditTrackingService.createChangesSummary(changes);

      expect(summary).toBe('Added 2 fields');
    });

    it('should summarize updated fields', () => {
      const changes = [
        {
          fieldId: 'field-1',
          fieldLabel: 'Name',
          fieldType: 'text_input_field',
          previousValue: 'John',
          newValue: 'Jane',
          changeType: 'UPDATE' as const,
        },
      ];

      const summary = ResponseEditTrackingService.createChangesSummary(changes);

      expect(summary).toBe('Updated 1 field');
    });

    it('should summarize deleted fields', () => {
      const changes = [
        {
          fieldId: 'field-1',
          fieldLabel: 'Name',
          fieldType: 'text_input_field',
          previousValue: 'John',
          newValue: null,
          changeType: 'DELETE' as const,
        },
      ];

      const summary = ResponseEditTrackingService.createChangesSummary(changes);

      expect(summary).toBe('Removed 1 field');
    });

    it('should summarize mixed changes', () => {
      const changes = [
        {
          fieldId: 'field-1',
          fieldLabel: 'Name',
          fieldType: 'text_input_field',
          previousValue: null,
          newValue: 'John',
          changeType: 'ADD' as const,
        },
        {
          fieldId: 'field-2',
          fieldLabel: 'Email',
          fieldType: 'email_field',
          previousValue: 'old@example.com',
          newValue: 'new@example.com',
          changeType: 'UPDATE' as const,
        },
        {
          fieldId: 'field-3',
          fieldLabel: 'Phone',
          fieldType: 'text_input_field',
          previousValue: '123456',
          newValue: null,
          changeType: 'DELETE' as const,
        },
      ];

      const summary = ResponseEditTrackingService.createChangesSummary(changes);

      expect(summary).toBe('Added 1 field, Updated 1 field, Removed 1 field');
    });
  });

  describe('recordEdit', () => {
    it('should record edit with changes', async () => {
      vi.mocked(responseRepository.createEditHistory).mockResolvedValue({} as any);
      vi.mocked(responseRepository.createFieldChange).mockResolvedValue({} as any);

      const oldData = { 'field-1': 'John' };
      const newData = { 'field-1': 'Jane' };

      await ResponseEditTrackingService.recordEdit(
        'response-123',
        oldData,
        newData,
        mockFormSchema,
        {
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          editType: 'MANUAL',
        }
      );

      expect(responseRepository.createEditHistory).toHaveBeenCalledWith({
        data: expect.objectContaining({
          responseId: 'response-123',
          editedById: 'user-123',
          editType: 'MANUAL',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          totalChanges: 1,
          changesSummary: 'Updated 1 field',
        }),
      });

      expect(responseRepository.createFieldChange).toHaveBeenCalledTimes(1);
    });

    it('should skip recording when no changes detected', async () => {
      const oldData = { 'field-1': 'John' };
      const newData = { 'field-1': 'John' };

      await ResponseEditTrackingService.recordEdit(
        'response-123',
        oldData,
        newData,
        mockFormSchema,
        {
          userId: 'user-123',
        }
      );

      expect(responseRepository.createEditHistory).not.toHaveBeenCalled();
      expect(responseRepository.createFieldChange).not.toHaveBeenCalled();
    });

    it('should create field change records for all changes', async () => {
      vi.mocked(responseRepository.createEditHistory).mockResolvedValue({} as any);
      vi.mocked(responseRepository.createFieldChange).mockResolvedValue({} as any);

      const oldData = { 'field-1': 'John', 'field-2': 'old@example.com' };
      const newData = { 'field-1': 'Jane', 'field-2': 'new@example.com' };

      await ResponseEditTrackingService.recordEdit(
        'response-123',
        oldData,
        newData,
        mockFormSchema,
        {
          userId: 'user-123',
        }
      );

      expect(responseRepository.createFieldChange).toHaveBeenCalledTimes(2);
    });

    it('should use default edit type when not provided', async () => {
      vi.mocked(responseRepository.createEditHistory).mockResolvedValue({} as any);
      vi.mocked(responseRepository.createFieldChange).mockResolvedValue({} as any);

      const oldData = {};
      const newData = { 'field-1': 'John' };

      await ResponseEditTrackingService.recordEdit(
        'response-123',
        oldData,
        newData,
        mockFormSchema,
        {
          userId: 'user-123',
        }
      );

      expect(responseRepository.createEditHistory).toHaveBeenCalledWith({
        data: expect.objectContaining({
          editType: 'MANUAL',
        }),
      });
    });
  });

  describe('getEditHistory', () => {
    it('should retrieve edit history for response', async () => {
      const mockHistory = [
        {
          id: 'edit-1',
          responseId: 'response-123',
          editedById: 'user-123',
          editedBy: {
            id: 'user-123',
            name: 'John Doe',
            email: 'john@example.com',
            image: null,
          },
          fieldChanges: [],
          editedAt: new Date(),
        },
      ];

      vi.mocked(responseRepository.findEditHistory).mockResolvedValue(mockHistory as any);

      const result = await ResponseEditTrackingService.getEditHistory('response-123');

      expect(responseRepository.findEditHistory).toHaveBeenCalledWith({
        where: { responseId: 'response-123' },
        include: {
          editedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          fieldChanges: {
            orderBy: { fieldId: 'asc' },
          },
        },
        orderBy: { editedAt: 'desc' },
      });
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getResponseWithFormSchema', () => {
    it('should return response with form schema from YJS', async () => {
      const mockResponse = {
        id: 'response-123',
        data: { 'field-1': 'John' },
        form: {
          id: 'form-123',
          formSchema: {},
        },
      };

      vi.mocked(responseRepository.findUnique).mockResolvedValue(mockResponse as any);

      const { getFormSchemaFromHocuspocus } = await import('../hocuspocus.js');
      vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(mockFormSchema as any);

      const result = await ResponseEditTrackingService.getResponseWithFormSchema('response-123');

      expect(result.response).toEqual(mockResponse);
      expect(result.formSchema).toBeDefined();
    });

    it('should fallback to database schema when YJS fails', async () => {
      const mockResponse = {
        id: 'response-123',
        data: { 'field-1': 'John' },
        form: {
          id: 'form-123',
          formSchema: mockFormSchema,
        },
      };

      vi.mocked(responseRepository.findUnique).mockResolvedValue(mockResponse as any);

      const { getFormSchemaFromHocuspocus } = await import('../hocuspocus.js');
      vi.mocked(getFormSchemaFromHocuspocus).mockRejectedValue(new Error('YJS error'));

      const loggerWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      const result = await ResponseEditTrackingService.getResponseWithFormSchema('response-123');

      expect(result.response).toEqual(mockResponse);
      expect(loggerWarn).toHaveBeenCalled();

      loggerWarn.mockRestore();
    });

    it('should throw error when response not found', async () => {
      vi.mocked(responseRepository.findUnique).mockResolvedValue(null);

      await expect(
        ResponseEditTrackingService.getResponseWithFormSchema('nonexistent')
      ).rejects.toThrow('Response not found');
    });

    it('should return empty schema when no valid schema found', async () => {
      const mockResponse = {
        id: 'response-123',
        data: {},
        form: {
          id: 'form-123',
          formSchema: {},
        },
      };

      vi.mocked(responseRepository.findUnique).mockResolvedValue(mockResponse as any);

      const { getFormSchemaFromHocuspocus } = await import('../hocuspocus.js');
      vi.mocked(getFormSchemaFromHocuspocus).mockRejectedValue(new Error('YJS error'));

      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});

      const result = await ResponseEditTrackingService.getResponseWithFormSchema('response-123');

      expect(result.formSchema.pages).toEqual([]);
      expect(loggerError).toHaveBeenCalled();

      loggerError.mockRestore();
    });
  });
});
