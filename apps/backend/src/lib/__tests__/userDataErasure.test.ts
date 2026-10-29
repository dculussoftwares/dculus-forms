import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
    response: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    responseFieldChange: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    responseEditHistory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  },
}));

import { prisma } from '../prisma.js';
import { anonymizeUserData } from '../userDataErasure.js';

describe('anonymizeUserData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('nulls respondent identity on responses', async () => {
    await anonymizeUserData('u1');
    expect(prisma.response.updateMany).toHaveBeenCalledWith({
      where: { respondentUserId: 'u1' },
      data: { respondentUserId: null, respondentEmail: null },
    });
  });

  it('scrubs respondent edit values and editor IP / user agent', async () => {
    await anonymizeUserData('u1');
    const fieldChangeArgs = vi.mocked(prisma.responseFieldChange.updateMany).mock.calls[0][0];
    expect(fieldChangeArgs.where).toEqual({
      editHistory: { editedById: 'u1', editType: 'RESPONDENT' },
    });
    expect(prisma.responseEditHistory.updateMany).toHaveBeenCalledWith({
      where: { editedById: 'u1' },
      data: { ipAddress: null, userAgent: null },
    });
  });
});
