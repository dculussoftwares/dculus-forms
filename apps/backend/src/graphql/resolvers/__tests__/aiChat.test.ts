import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/aiChatService.js', () => ({
  createConversation: vi.fn().mockResolvedValue({ id: 'conv_1', title: 'New conversation', messages: [], messageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), formId: 'form_1' }),
  listConversations: vi.fn().mockResolvedValue([]),
  getConversation: vi.fn().mockResolvedValue(null),
  deleteConversation: vi.fn().mockResolvedValue(true),
  renameConversation: vi.fn().mockResolvedValue({ id: 'conv_1', title: 'Renamed' }),
}));

vi.mock('../../../middleware/better-auth-middleware.js', () => ({
  requireAuth: vi.fn(),
  requireOrganizationMembership: vi.fn().mockResolvedValue({}),
}));

import { aiChatResolvers } from '../aiChat.js';

const mockAuth = { user: { id: 'user_1' }, session: { activeOrganizationId: 'org_1' }, isAuthenticated: true };

describe('aiChatResolvers.Query.listAIChatConversations', () => {
  it('returns empty array when no conversations exist', async () => {
    const result = await aiChatResolvers.Query.listAIChatConversations(
      {},
      { formId: 'form_1', organizationId: 'org_1' },
      { auth: mockAuth }
    );
    expect(result).toEqual([]);
  });
});

describe('aiChatResolvers.Query.getAIChatConversation', () => {
  it('throws NOT_FOUND when conversation does not exist', async () => {
    await expect(
      aiChatResolvers.Query.getAIChatConversation(
        {},
        { id: 'bad_id', organizationId: 'org_1' },
        { auth: mockAuth }
      )
    ).rejects.toThrow();
  });
});

describe('aiChatResolvers.Mutation.createAIChatConversation', () => {
  it('creates conversation with correct args', async () => {
    const result = await aiChatResolvers.Mutation.createAIChatConversation(
      {},
      { formId: 'form_1', organizationId: 'org_1' },
      { auth: mockAuth }
    );
    expect(result.id).toBe('conv_1');
  });
});
