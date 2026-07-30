import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInvitationRepository } from '../invitationRepository.js';

describe('Invitation Repository', () => {
  const mockPrisma = {
    invitation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  };

  const mockContext = { prisma: mockPrisma as any };
  let repository: ReturnType<typeof createInvitationRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createInvitationRepository(mockContext);
  });

  describe('findMany', () => {
    it('delegates to prisma.invitation.findMany', async () => {
      const mockInvitations = [{ id: 'invitation-1' }];
      mockPrisma.invitation.findMany.mockResolvedValue(mockInvitations as any);

      const result = await repository.findMany({ where: { status: 'pending' } });

      expect(result).toEqual(mockInvitations);
      expect(mockPrisma.invitation.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
      });
    });
  });

  describe('findUnique', () => {
    it('delegates to prisma.invitation.findUnique', async () => {
      const mockInvitation = { id: 'invitation-1' };
      mockPrisma.invitation.findUnique.mockResolvedValue(mockInvitation as any);

      const result = await repository.findUnique({ where: { id: 'invitation-1' } });

      expect(result).toEqual(mockInvitation);
      expect(mockPrisma.invitation.findUnique).toHaveBeenCalledWith({
        where: { id: 'invitation-1' },
      });
    });
  });

  describe('create', () => {
    it('delegates to prisma.invitation.create', async () => {
      const data = {
        email: 'invitee@example.com',
        role: 'member',
        organizationId: 'org-1',
        inviterId: 'user-1',
        expiresAt: new Date('2024-12-31'),
      };
      const created = { id: 'invitation-1', ...data };
      mockPrisma.invitation.create.mockResolvedValue(created as any);

      const result = await repository.create({ data });

      expect(result).toEqual(created);
      expect(mockPrisma.invitation.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('update', () => {
    it('delegates to prisma.invitation.update', async () => {
      const updated = { id: 'invitation-1', status: 'accepted' };
      mockPrisma.invitation.update.mockResolvedValue(updated as any);

      const result = await repository.update({
        where: { id: 'invitation-1' },
        data: { status: 'accepted' },
      });

      expect(result).toEqual(updated);
      expect(mockPrisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'invitation-1' },
        data: { status: 'accepted' },
      });
    });
  });

  describe('delete', () => {
    it('delegates to prisma.invitation.delete', async () => {
      const deleted = { id: 'invitation-1' };
      mockPrisma.invitation.delete.mockResolvedValue(deleted as any);

      const result = await repository.delete({ where: { id: 'invitation-1' } });

      expect(result).toEqual(deleted);
      expect(mockPrisma.invitation.delete).toHaveBeenCalledWith({
        where: { id: 'invitation-1' },
      });
    });
  });

  describe('count', () => {
    it('delegates to prisma.invitation.count', async () => {
      mockPrisma.invitation.count.mockResolvedValue(3);

      const result = await repository.count({ where: { status: 'pending' } });

      expect(result).toBe(3);
      expect(mockPrisma.invitation.count).toHaveBeenCalledWith({
        where: { status: 'pending' },
      });
    });
  });

  describe('findById', () => {
    it('fetches an invitation with organization and inviter included', async () => {
      const mockInvitation = {
        id: 'invitation-1',
        organization: { id: 'org-1', name: 'Acme', slug: 'acme' },
        inviter: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
      };
      mockPrisma.invitation.findUnique.mockResolvedValue(mockInvitation as any);

      const result = await repository.findById('invitation-1');

      expect(result).toEqual(mockInvitation);
      expect(mockPrisma.invitation.findUnique).toHaveBeenCalledWith({
        where: { id: 'invitation-1' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          inviter: { select: { id: true, name: true, email: true } },
        },
      });
    });

    it('returns null when no invitation is found', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });
});
