import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invitationResolvers } from '../invitations.js';
import { GraphQLError } from 'graphql';
import { prisma } from '../../../lib/prisma.js';
import * as dateHelpers from '../../../utils/dateHelpers.js';

// Mock all dependencies
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    invitation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    member: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../utils/dateHelpers.js', () => ({
  parseDate: vi.fn((dateString: string) => new Date(dateString)),
  isDateExpired: vi.fn(() => false),
}));

describe('Invitation Resolvers', () => {
  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org',
    logo: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockInviter = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
  };

  const mockInvitation = {
    id: 'invitation-123',
    email: 'invitee@example.com',
    role: 'member',
    status: 'pending',
    expiresAt: new Date('2024-12-31'),
    createdAt: new Date('2024-01-01'),
    organizationId: 'org-123',
    inviterId: 'user-123',
    organization: mockOrganization,
    inviter: mockInviter,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset date helpers to default behavior
    vi.mocked(dateHelpers.isDateExpired).mockReturnValue(false);
    vi.mocked(dateHelpers.parseDate).mockImplementation((dateString: string) => new Date(dateString));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Query: getInvitationPublic', () => {
    describe('Validation', () => {
      it('should throw error when invitation ID is not provided', async () => {
        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: '' })
        ).rejects.toThrow(GraphQLError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: '' })
        ).rejects.toThrow('Invitation ID is required');
      });

      it('should throw error when invitation ID is null', async () => {
        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: null as any })
        ).rejects.toThrow(GraphQLError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: null as any })
        ).rejects.toThrow('Invitation ID is required');
      });

      it('should throw error when invitation ID is undefined', async () => {
        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: undefined as any })
        ).rejects.toThrow(GraphQLError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: undefined as any })
        ).rejects.toThrow('Invitation ID is required');
      });
    });

    describe('Invitation Not Found', () => {
      it('should throw error when invitation does not exist', async () => {
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'nonexistent-id' })
        ).rejects.toThrow(GraphQLError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'nonexistent-id' })
        ).rejects.toThrow('Invitation not found');
      });

      it('should call prisma with correct parameters', async () => {
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'test-id' })
        ).rejects.toThrow();

        expect(prisma.invitation.findUnique).toHaveBeenCalledWith({
          where: { id: 'test-id' },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            inviter: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
      });
    });

    describe('Invitation Status Validation', () => {
      it('should throw error when invitation status is accepted', async () => {
        const acceptedInvitation = {
          ...mockInvitation,
          status: 'accepted',
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(acceptedInvitation as any);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow(GraphQLError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow('Invitation has already been accepted');
      });

      it('should throw error when invitation status is cancelled', async () => {
        const cancelledInvitation = {
          ...mockInvitation,
          status: 'cancelled',
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(cancelledInvitation as any);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow(GraphQLError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow('Invitation has already been cancelled');
      });

      it('should throw error when invitation status is rejected', async () => {
        const rejectedInvitation = {
          ...mockInvitation,
          status: 'rejected',
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(rejectedInvitation as any);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow(GraphQLError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow('Invitation has already been rejected');
      });

      it('should check status before checking expiry', async () => {
        const acceptedInvitation = {
          ...mockInvitation,
          status: 'accepted',
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(acceptedInvitation as any);
        vi.mocked(dateHelpers.isDateExpired).mockReturnValue(true);

        // Should throw "already been accepted" error, not "expired" error
        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow('Invitation has already been accepted');
      });
    });

    describe('Invitation Expiry Validation', () => {
      it('should throw error when invitation is expired', async () => {
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(mockInvitation as any);
        vi.mocked(dateHelpers.isDateExpired).mockReturnValue(true);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow(GraphQLError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow('Invitation has expired');
      });

      it('should call isDateExpired with correct date string', async () => {
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(mockInvitation as any);
        vi.mocked(dateHelpers.isDateExpired).mockReturnValue(true);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow();

        expect(dateHelpers.isDateExpired).toHaveBeenCalledWith(
          mockInvitation.expiresAt.toISOString()
        );
      });

      it('should allow valid invitation with future expiry date', async () => {
        const futureDate = new Date('2025-12-31');
        const validInvitation = {
          ...mockInvitation,
          expiresAt: futureDate,
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(validInvitation as any);
        vi.mocked(dateHelpers.isDateExpired).mockReturnValue(false);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        expect(result).toBeDefined();
        expect(result.expiresAt).toBe(futureDate.toISOString());
      });
    });

    describe('Successful Invitation Retrieval', () => {
      it('should return invitation with all public fields', async () => {
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(mockInvitation as any);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        expect(result).toEqual({
          id: 'invitation-123',
          email: 'invitee@example.com',
          role: 'member',
          status: 'pending',
          expiresAt: mockInvitation.expiresAt.toISOString(),
          createdAt: mockInvitation.createdAt.toISOString(),
          organization: {
            id: 'org-123',
            name: 'Test Organization',
            slug: 'test-org',
          },
          inviter: {
            id: 'user-123',
            name: 'John Doe',
            email: 'john@example.com',
          },
        });
      });

      it('should return invitation with null organization if not present', async () => {
        const invitationWithoutOrg = {
          ...mockInvitation,
          organization: null,
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitationWithoutOrg as any);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        expect(result.organization).toBeNull();
      });

      it('should return invitation with null inviter if not present', async () => {
        const invitationWithoutInviter = {
          ...mockInvitation,
          inviter: null,
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitationWithoutInviter as any);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        expect(result.inviter).toBeNull();
      });

      it('should convert dates to ISO strings', async () => {
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(mockInvitation as any);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        expect(typeof result.expiresAt).toBe('string');
        expect(typeof result.createdAt).toBe('string');
        expect(result.expiresAt).toBe(mockInvitation.expiresAt.toISOString());
        expect(result.createdAt).toBe(mockInvitation.createdAt.toISOString());
      });

      it('should handle invitation with owner role', async () => {
        const ownerInvitation = {
          ...mockInvitation,
          role: 'owner',
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(ownerInvitation as any);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        expect(result.role).toBe('owner');
      });

      it('should only expose safe public information', async () => {
        const invitationWithExtraFields = {
          ...mockInvitation,
          internalNote: 'This should not be exposed',
          secretToken: 'secret-123',
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitationWithExtraFields as any);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        // Should not include any fields beyond the expected ones
        expect(result).not.toHaveProperty('internalNote');
        expect(result).not.toHaveProperty('secretToken');
        expect(result).not.toHaveProperty('organizationId');
        expect(result).not.toHaveProperty('inviterId');
      });
    });

    describe('Error Handling', () => {
      it('should re-throw GraphQLError instances', async () => {
        const customError = new GraphQLError('Custom error message');
        vi.mocked(prisma.invitation.findUnique).mockRejectedValue(customError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow(GraphQLError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow('Custom error message');
      });

      it('should convert non-GraphQLError to GraphQLError', async () => {
        const databaseError = new Error('Database connection failed');
        vi.mocked(prisma.invitation.findUnique).mockRejectedValue(databaseError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow(GraphQLError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow('Failed to fetch invitation');
      });

      it('should handle prisma errors gracefully', async () => {
        const prismaError = new Error('P2021: Table does not exist');
        vi.mocked(prisma.invitation.findUnique).mockRejectedValue(prismaError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow('Failed to fetch invitation');
      });

      it('should handle null pointer exceptions', async () => {
        const nullError = new TypeError("Cannot read property 'toISOString' of null");
        vi.mocked(prisma.invitation.findUnique).mockRejectedValue(nullError);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
        ).rejects.toThrow('Failed to fetch invitation');
      });
    });

    describe('Edge Cases', () => {
      it('should handle invitation with minimal data', async () => {
        const minimalInvitation = {
          id: 'invitation-123',
          email: 'test@example.com',
          role: 'member',
          status: 'pending',
          expiresAt: new Date('2024-12-31'),
          createdAt: new Date('2024-01-01'),
          organizationId: 'org-123',
          inviterId: 'user-123',
          organization: null,
          inviter: null,
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(minimalInvitation as any);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        expect(result).toBeDefined();
        expect(result.organization).toBeNull();
        expect(result.inviter).toBeNull();
      });

      it('should handle invitation with special characters in email', async () => {
        const specialEmailInvitation = {
          ...mockInvitation,
          email: 'test+filter@example.co.uk',
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(specialEmailInvitation as any);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        expect(result.email).toBe('test+filter@example.co.uk');
      });

      it('should handle invitation with special characters in organization name', async () => {
        const specialOrgInvitation = {
          ...mockInvitation,
          organization: {
            ...mockOrganization,
            name: 'Test & Co. (2024)',
          },
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(specialOrgInvitation as any);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        expect(result.organization?.name).toBe('Test & Co. (2024)');
      });

      it('should handle invitation with very long IDs', async () => {
        const longId = 'a'.repeat(100);
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null);

        await expect(
          invitationResolvers.Query.getInvitationPublic({}, { id: longId })
        ).rejects.toThrow('Invitation not found');

        expect(prisma.invitation.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: longId } })
        );
      });

      it('should handle invitation exactly at expiry time', async () => {
        const now = new Date();
        const expiringInvitation = {
          ...mockInvitation,
          expiresAt: now,
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(expiringInvitation as any);

        // Mock isDateExpired to return false (not yet expired)
        vi.mocked(dateHelpers.isDateExpired).mockReturnValue(false);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        expect(result).toBeDefined();
        expect(result.expiresAt).toBe(now.toISOString());
      });
    });

    describe('Multiple Invitation Scenarios', () => {
      it('should handle different invitation statuses correctly', async () => {
        const statuses = ['pending', 'accepted', 'rejected', 'cancelled'];

        for (const status of statuses) {
          vi.clearAllMocks();
          const invitation = {
            ...mockInvitation,
            status,
          };
          vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitation as any);

          if (status === 'pending') {
            const result = await invitationResolvers.Query.getInvitationPublic(
              {},
              { id: 'invitation-123' }
            );
            expect(result.status).toBe('pending');
          } else {
            await expect(
              invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' })
            ).rejects.toThrow(`Invitation has already been ${status}`);
          }
        }
      });

      it('should handle different role types', async () => {
        const roles = ['member', 'owner'];

        for (const role of roles) {
          vi.clearAllMocks();
          const invitation = {
            ...mockInvitation,
            role,
          };
          vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitation as any);

          const result = await invitationResolvers.Query.getInvitationPublic(
            {},
            { id: 'invitation-123' }
          );

          expect(result.role).toBe(role);
        }
      });
    });

    describe('Date Handling', () => {
      it('should properly handle Date objects from database', async () => {
        const specificDate = new Date('2024-06-15T10:30:00.000Z');
        const invitation = {
          ...mockInvitation,
          createdAt: specificDate,
          expiresAt: new Date('2024-12-31T23:59:59.999Z'),
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitation as any);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        expect(result.createdAt).toBe('2024-06-15T10:30:00.000Z');
        expect(result.expiresAt).toBe('2024-12-31T23:59:59.999Z');
      });

      it('should handle timezone differences correctly', async () => {
        const utcDate = new Date('2024-01-01T00:00:00.000Z');
        const invitation = {
          ...mockInvitation,
          expiresAt: utcDate,
        };
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitation as any);

        const result = await invitationResolvers.Query.getInvitationPublic(
          {},
          { id: 'invitation-123' }
        );

        // Should always return UTC ISO string
        expect(result.expiresAt).toBe('2024-01-01T00:00:00.000Z');
      });
    });

    describe('Database Query Optimization', () => {
      it('should use efficient includes for related data', async () => {
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(mockInvitation as any);

        await invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' });

        expect(prisma.invitation.findUnique).toHaveBeenCalledWith({
          where: { id: 'invitation-123' },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            inviter: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
      });

      it('should only select necessary organization fields', async () => {
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(mockInvitation as any);

        await invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' });

        const call = vi.mocked(prisma.invitation.findUnique).mock.calls[0][0];
        const orgSelect = call?.include?.organization?.select;

        expect(orgSelect).toBeDefined();
        expect(orgSelect).toEqual({
          id: true,
          name: true,
          slug: true,
        });
      });

      it('should only select necessary inviter fields', async () => {
        vi.mocked(prisma.invitation.findUnique).mockResolvedValue(mockInvitation as any);

        await invitationResolvers.Query.getInvitationPublic({}, { id: 'invitation-123' });

        const call = vi.mocked(prisma.invitation.findUnique).mock.calls[0][0];
        const inviterSelect = call?.include?.inviter?.select;

        expect(inviterSelect).toBeDefined();
        expect(inviterSelect).toEqual({
          id: true,
          name: true,
          email: true,
        });
      });
    });
  });
});
