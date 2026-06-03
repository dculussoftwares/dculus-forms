import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PluginEvent, PluginContext } from '../../core/types.js';
import type { AiTaggerPluginConfig } from '../types.js';
import { aiTaggerMetadataKey } from '../types.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn(() => ({})) },
}));

vi.mock('../../../../lib/ai.js', () => ({
  getFastModel: vi.fn(() => 'mock-model'),
}));

const TEST_PLUGIN_ID = 'plugin-abc';

describe('AI Tagger Handler', () => {
  let mockContext: PluginContext;
  let mockPrisma: any;
  let mockEvent: PluginEvent;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      responseTagAssignment: { upsert: vi.fn() },
      response: { update: vi.fn() },
    };

    mockContext = {
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
      getFormById: vi.fn(),
      getResponseById: vi.fn(),
      getResponsesByFormId: vi.fn(),
      getOrganization: vi.fn(),
      getUserById: vi.fn(),
      sendEmail: vi.fn(),
      prisma: mockPrisma,
    };

    mockEvent = {
      type: 'form.submitted',
      formId: 'form-1',
      organizationId: 'org-1',
      timestamp: new Date(),
      data: { responseId: 'response-1' },
    };
  });

  afterEach(() => vi.restoreAllMocks());

  it('skips when no tags have definitions', async () => {
    const { aiTaggerHandler } = await import('../handler.js');
    const plugin = {
      id: TEST_PLUGIN_ID,
      config: {
        type: 'ai-tagger',
        tags: [{ tagId: 'tag-1', name: 'Urgent', color: '#ef4444', definition: '' }],
      } as AiTaggerPluginConfig,
    };

    const result = await aiTaggerHandler(plugin, mockEvent, mockContext);

    expect(result.tagsApplied).toHaveLength(0);
    expect(result.tagsConsidered).toBe(0);
    expect(mockContext.getResponseById).not.toHaveBeenCalled();
  });

  it('skips when config.tags is empty', async () => {
    const { aiTaggerHandler } = await import('../handler.js');
    const plugin = {
      id: TEST_PLUGIN_ID,
      config: { type: 'ai-tagger', tags: [] } as AiTaggerPluginConfig,
    };

    const result = await aiTaggerHandler(plugin, mockEvent, mockContext);

    expect(result.tagsApplied).toHaveLength(0);
    expect(mockContext.getResponseById).not.toHaveBeenCalled();
  });

  it('assigns matching tags returned by AI', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({
      output: { tagIds: ['tag-1'] },
      usage: { totalTokens: 150 },
    });

    mockContext.getResponseById = vi.fn().mockResolvedValue({
      id: 'response-1',
      data: { Issue: 'My invoice is wrong' },
      metadata: {},
    });

    const { aiTaggerHandler } = await import('../handler.js');
    const plugin = {
      id: TEST_PLUGIN_ID,
      config: {
        type: 'ai-tagger',
        tags: [{ tagId: 'tag-1', name: 'Billing', color: '#3b82f6', definition: 'Mentions payment or invoice' }],
      } as AiTaggerPluginConfig,
    };

    const result = await aiTaggerHandler(plugin, mockEvent, mockContext);

    expect(result.success).toBe(true);
    expect(result.tagsApplied).toEqual(['tag-1']);
    expect(result.tokensUsed).toBe(150);
    expect(mockPrisma.responseTagAssignment.upsert).toHaveBeenCalledOnce();
    expect(mockPrisma.responseTagAssignment.upsert).toHaveBeenCalledWith({
      where: { responseId_tagId: { responseId: 'response-1', tagId: 'tag-1' } },
      create: { responseId: 'response-1', tagId: 'tag-1' },
      update: {},
    });
    expect(mockPrisma.response.update).toHaveBeenCalledOnce();
  });

  it('filters out hallucinated tag IDs not present in config', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({
      output: { tagIds: ['tag-1', 'hallucinated-id-999'] },
      usage: { totalTokens: 100 },
    });

    mockContext.getResponseById = vi.fn().mockResolvedValue({
      id: 'response-1',
      data: { Issue: 'billing problem' },
      metadata: {},
    });

    const { aiTaggerHandler } = await import('../handler.js');
    const plugin = {
      id: TEST_PLUGIN_ID,
      config: {
        type: 'ai-tagger',
        tags: [{ tagId: 'tag-1', name: 'Billing', color: '#3b82f6', definition: 'Payment or billing' }],
      } as AiTaggerPluginConfig,
    };

    const result = await aiTaggerHandler(plugin, mockEvent, mockContext);

    expect(result.tagsApplied).toEqual(['tag-1']);
    expect(mockPrisma.responseTagAssignment.upsert).toHaveBeenCalledTimes(1);
  });

  it('stores result in response metadata under ai-tagger:{pluginId} key', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({
      output: { tagIds: ['tag-1'] },
      usage: { totalTokens: 80 },
    });

    mockContext.getResponseById = vi.fn().mockResolvedValue({
      id: 'response-1',
      data: { Issue: 'urgent billing issue' },
      metadata: { 'some-other-key': 'existing-data' },
    });

    const { aiTaggerHandler } = await import('../handler.js');
    const plugin = {
      id: TEST_PLUGIN_ID,
      config: {
        type: 'ai-tagger',
        tags: [{ tagId: 'tag-1', name: 'Billing', color: '#3b82f6', definition: 'Billing issue' }],
      } as AiTaggerPluginConfig,
    };

    await aiTaggerHandler(plugin, mockEvent, mockContext);

    const updateCall = mockPrisma.response.update.mock.calls[0][0];
    const metadata = updateCall.data.metadata;
    expect(metadata['some-other-key']).toBe('existing-data');
    expect(metadata[aiTaggerMetadataKey(TEST_PLUGIN_ID)]).toMatchObject({
      success: true,
      tagsApplied: ['tag-1'],
      tagsConsidered: 1,
    });
  });

  it('returns silently on AI error without throwing', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockRejectedValue(new Error('AI service unavailable'));

    mockContext.getResponseById = vi.fn().mockResolvedValue({
      id: 'response-1',
      data: { Issue: 'test' },
      metadata: {},
    });

    const { aiTaggerHandler } = await import('../handler.js');
    const plugin = {
      id: TEST_PLUGIN_ID,
      config: {
        type: 'ai-tagger',
        tags: [{ tagId: 'tag-1', name: 'Urgent', color: '#ef4444', definition: 'Urgent issues' }],
      } as AiTaggerPluginConfig,
    };

    const result = await aiTaggerHandler(plugin, mockEvent, mockContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('AI service unavailable');
    expect(mockContext.logger.error).toHaveBeenCalled();
    expect(mockPrisma.responseTagAssignment.upsert).not.toHaveBeenCalled();
  });

  it('returns error when event has no responseId', async () => {
    const { aiTaggerHandler } = await import('../handler.js');
    const plugin = {
      id: TEST_PLUGIN_ID,
      config: {
        type: 'ai-tagger',
        tags: [{ tagId: 'tag-1', name: 'Billing', color: '#3b82f6', definition: 'Payment issue' }],
      } as AiTaggerPluginConfig,
    };

    const eventWithoutResponseId: PluginEvent = { ...mockEvent, data: {} };
    const result = await aiTaggerHandler(plugin, eventWithoutResponseId, mockContext);

    expect(result.success).toBe(false);
    expect((result as any).error).toBe('No response ID');
    expect(mockContext.getResponseById).not.toHaveBeenCalled();
  });

  it('returns error when response is not found', async () => {
    mockContext.getResponseById = vi.fn().mockResolvedValue(null);

    const { aiTaggerHandler } = await import('../handler.js');
    const plugin = {
      id: TEST_PLUGIN_ID,
      config: {
        type: 'ai-tagger',
        tags: [{ tagId: 'tag-1', name: 'Billing', color: '#3b82f6', definition: 'Payment issue' }],
      } as AiTaggerPluginConfig,
    };

    const result = await aiTaggerHandler(plugin, mockEvent, mockContext);

    expect(result.success).toBe(false);
    expect((result as any).error).toBe('Response not found');
    expect(mockContext.logger.warn).toHaveBeenCalled();
  });

  it('handles null response.data and null response.metadata gracefully', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({
      output: { tagIds: [] },
      usage: { totalTokens: 50 },
    });

    mockContext.getResponseById = vi.fn().mockResolvedValue({
      id: 'response-1',
      data: null,
      metadata: null,
    });

    const { aiTaggerHandler } = await import('../handler.js');
    const plugin = {
      id: TEST_PLUGIN_ID,
      config: {
        type: 'ai-tagger',
        tags: [{ tagId: 'tag-1', name: 'Billing', color: '#3b82f6', definition: 'Payment issue' }],
      } as AiTaggerPluginConfig,
    };

    const result = await aiTaggerHandler(plugin, mockEvent, mockContext);

    expect(result.success).toBe(true);
    expect(result.tagsApplied).toHaveLength(0);
  });

  it('handles null usage from AI response', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({
      output: { tagIds: ['tag-1'] },
      usage: null,
    });

    mockContext.getResponseById = vi.fn().mockResolvedValue({
      id: 'response-1',
      data: { Issue: 'billing problem' },
      metadata: {},
    });

    const { aiTaggerHandler } = await import('../handler.js');
    const plugin = {
      id: TEST_PLUGIN_ID,
      config: {
        type: 'ai-tagger',
        tags: [{ tagId: 'tag-1', name: 'Billing', color: '#3b82f6', definition: 'Payment issue' }],
      } as AiTaggerPluginConfig,
    };

    const result = await aiTaggerHandler(plugin, mockEvent, mockContext);

    expect(result.success).toBe(true);
    expect(result.tokensUsed).toBe(0);
  });

  it('handles null output.tagIds from AI response', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({
      output: { tagIds: null },
      usage: { totalTokens: 30 },
    });

    mockContext.getResponseById = vi.fn().mockResolvedValue({
      id: 'response-1',
      data: { Issue: 'test' },
      metadata: {},
    });

    const { aiTaggerHandler } = await import('../handler.js');
    const plugin = {
      id: TEST_PLUGIN_ID,
      config: {
        type: 'ai-tagger',
        tags: [{ tagId: 'tag-1', name: 'Billing', color: '#3b82f6', definition: 'Payment issue' }],
      } as AiTaggerPluginConfig,
    };

    const result = await aiTaggerHandler(plugin, mockEvent, mockContext);

    expect(result.success).toBe(true);
    expect(result.tagsApplied).toHaveLength(0);
  });
});
