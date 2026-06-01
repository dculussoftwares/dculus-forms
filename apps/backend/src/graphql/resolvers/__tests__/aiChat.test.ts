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

import { getConversation, renameConversation } from '../../../services/aiChatService.js';
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

  it('returns conversation when found', async () => {
    const conv = { id: 'conv_1', title: 'Test', messages: [], messageCount: 0 };
    vi.mocked(getConversation).mockResolvedValueOnce(conv as any);
    const result = await aiChatResolvers.Query.getAIChatConversation(
      {},
      { id: 'conv_1', organizationId: 'org_1' },
      { auth: mockAuth }
    );
    expect(result).toBe(conv);
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

describe('aiChatResolvers.Mutation.deleteAIChatConversation', () => {
  it('deletes conversation and returns true', async () => {
    const result = await aiChatResolvers.Mutation.deleteAIChatConversation(
      {},
      { id: 'conv_1', organizationId: 'org_1' },
      { auth: mockAuth }
    );
    expect(result).toBe(true);
  });
});

describe('aiChatResolvers.Mutation.renameAIChatConversation', () => {
  it('returns renamed conversation on success', async () => {
    vi.mocked(renameConversation).mockResolvedValueOnce({ id: 'conv_1', title: 'Renamed' } as any);
    const result = await aiChatResolvers.Mutation.renameAIChatConversation(
      {},
      { id: 'conv_1', organizationId: 'org_1', title: 'Renamed' },
      { auth: mockAuth }
    );
    expect(result.id).toBe('conv_1');
  });

  it('throws NOT_FOUND when conversation does not exist', async () => {
    vi.mocked(renameConversation).mockResolvedValueOnce(null as any);
    await expect(
      aiChatResolvers.Mutation.renameAIChatConversation(
        {},
        { id: 'bad_id', organizationId: 'org_1', title: 'New' },
        { auth: mockAuth }
      )
    ).rejects.toThrow();
  });
});
