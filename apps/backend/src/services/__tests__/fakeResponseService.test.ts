import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldType } from '@dculus/types';
import { generateFakeResponsesForForm } from '../fakeResponseService.js';
import { generateAiFakeResponses } from '../aiService.js';
import { responseRepository } from '../../repositories/index.js';

vi.mock('../aiService.js', () => ({ generateAiFakeResponses: vi.fn() }));
vi.mock('../../repositories/index.js');
vi.mock('../fileUploadService.js', () => ({ ensureSyntheticResponseFile: vi.fn(), downloadFileBuffer: vi.fn() }));
vi.mock('../tagService.js', () => ({
  AI_GENERATED_RESPONSE_SOURCE: 'ai_generated',
  upsertAiGeneratedTag: vi.fn().mockResolvedValue({ id: 'tag-1' }),
}));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

describe('generateFakeResponsesForForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never sends a grid layout field to the AI or stores an answer for it', async () => {
    const schema = {
      pages: [
        {
          fields: [
            { id: 'g1', type: FieldType.GRID_FIELD, columnWidths: [50, 50] },
            { id: 'f-name', type: FieldType.TEXT_INPUT_FIELD, label: 'Name', gridId: 'g1', gridColumn: 0 },
            { id: 'f-email', type: FieldType.EMAIL_FIELD, label: 'Email', gridId: 'g1', gridColumn: 1 },
          ],
        },
      ],
    };
    vi.mocked(generateAiFakeResponses).mockResolvedValue({
      responses: [{ g1: 'Invented', 'f-name': 'Priya Raman', 'f-email': 'priya@example.com' }],
      tokensUsed: 7,
    } as Awaited<ReturnType<typeof generateAiFakeResponses>>);

    const result = await generateFakeResponsesForForm('form-1', 'Signup', schema, 1);

    expect(generateAiFakeResponses).toHaveBeenCalledWith({
      formTitle: 'Signup',
      entries: [
        { id: 'f-name', type: 'text input', label: 'Name' },
        { id: 'f-email', type: 'email', label: 'Email' },
      ],
      count: 1,
    });
    const { data } = vi.mocked(responseRepository.createMany).mock.calls[0][0] as { data: { data: unknown }[] };
    expect(data[0].data).toEqual({ 'f-name': 'Priya Raman', 'f-email': 'priya@example.com' });
    expect(result).toEqual({ created: 1, tokensUsed: 7 });
  });
});
