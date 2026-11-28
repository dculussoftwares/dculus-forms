import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/index.js', () => ({
  brandKitRepository: {
    findByOrganization: vi.fn(),
    upsertForOrganization: vi.fn(),
    deleteByOrganization: vi.fn(),
  },
}));

import { brandKitRepository } from '../../repositories/index.js';
import { getBrandKit, saveBrandKit, deleteBrandKit } from '../brandKitService.js';

const repo = vi.mocked(brandKitRepository);

describe('brandKitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBrandKit', () => {
    it('returns null when the organization has no brand kit', async () => {
      repo.findByOrganization.mockResolvedValue(null);
      await expect(getBrandKit('org-1')).resolves.toBeNull();
      expect(repo.findByOrganization).toHaveBeenCalledWith('org-1');
    });
  });

  describe('saveBrandKit', () => {
    it('sanitizes tokens, dropping unknown and invalid keys, before saving', async () => {
      repo.upsertForOrganization.mockResolvedValue({ id: 'kit-1' } as any);

      await saveBrandKit('org-1', 'user-1', 'owner', {
        primaryColor: '#112233',
        surfaceColor: 'not-a-color',
        evil: '<script>',
      });

      expect(repo.upsertForOrganization).toHaveBeenCalledWith(
        'org-1',
        { version: 1, primaryColor: '#112233' },
        'user-1'
      );
    });

    it.each([[{}], [null], [[]], ['str'], [{ primaryColor: 'red' }]])(
      'rejects empty or invalid tokens (%j)',
      async (tokens) => {
        await expect(saveBrandKit('org-1', 'user-1', 'owner', tokens)).rejects.toMatchObject({
          extensions: { code: 'BAD_USER_INPUT' },
        });
        expect(repo.upsertForOrganization).not.toHaveBeenCalled();
      }
    );

    it.each(['member', null, undefined])('rejects non-owner role %s', async (role) => {
      await expect(
        saveBrandKit('org-1', 'user-1', role, { primaryColor: '#112233' })
      ).rejects.toMatchObject({ extensions: { code: 'NO_ACCESS' } });
      expect(repo.upsertForOrganization).not.toHaveBeenCalled();
    });
  });

  describe('deleteBrandKit', () => {
    it('deletes for an owner and returns true even when nothing existed', async () => {
      repo.deleteByOrganization.mockResolvedValue({ count: 0 } as any);
      await expect(deleteBrandKit('org-1', 'owner')).resolves.toBe(true);
      expect(repo.deleteByOrganization).toHaveBeenCalledWith('org-1');
    });

    it('rejects non-owners', async () => {
      await expect(deleteBrandKit('org-1', 'member')).rejects.toMatchObject({
        extensions: { code: 'NO_ACCESS' },
      });
      expect(repo.deleteByOrganization).not.toHaveBeenCalled();
    });
  });
});
