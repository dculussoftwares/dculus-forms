import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma.js', () => ({
  prisma: { form: { count: vi.fn() } },
}));

import { prisma } from '../prisma.js';
import { assertUserOwnsNoForms } from '../userDeletionGuard.js';

describe('assertUserOwnsNoForms', () => {
  beforeEach(() => {
    vi.mocked(prisma.form.count).mockReset();
  });

  it('allows deletion when the user owns no forms', async () => {
    vi.mocked(prisma.form.count).mockResolvedValue(0);
    await expect(assertUserOwnsNoForms('u1')).resolves.toBeUndefined();
    expect(prisma.form.count).toHaveBeenCalledWith({ where: { createdById: 'u1' } });
  });

  it('refuses deletion while the user still owns forms', async () => {
    vi.mocked(prisma.form.count).mockResolvedValue(3);
    await expect(assertUserOwnsNoForms('u1')).rejects.toThrow(/owns 3 forms/);
  });

  it('uses the singular for one form', async () => {
    vi.mocked(prisma.form.count).mockResolvedValue(1);
    await expect(assertUserOwnsNoForms('u1')).rejects.toThrow(/owns 1 form\./);
  });
});
