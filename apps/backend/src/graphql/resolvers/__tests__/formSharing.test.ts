import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formSharingResolvers, checkFormAccess, PermissionLevel, SharingScope } from '../formSharing.js';
import { GraphQLError } from 'graphql';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import { prisma } from '../../../lib/prisma.js';

// Mock all dependencies
vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    form: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    formPermission: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
    member: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
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

describe('FormSharing Resolvers', () => {
  const mockContext = {
    auth: {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
      session: { id: 'session-123' },
      isAuthenticated: true,
    },
  };

  const mockForm = {
    id: 'form-123',
    title: 'Test Form',
    description: 'Test Description',
    organizationId: 'org-123',
    createdById: 'user-123',
    sharingScope: SharingScope.PRIVATE,
    defaultPermission: PermissionLevel.VIEWER,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    organization: {
      id: 'org-123',
      name: 'Test Org',
      members: [
        {
          userId: 'user-123',
          organizationId: 'org-123',
          role: 'owner',
          user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        },
      ],
    },
    createdBy: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
    permissions: [],
  };

  const mockUser2 = {
    id: 'user-456',
    email: 'user2@example.com',
    name: 'User 2',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkFormAccess', () => {
    describe('Form not found', () => {
      it('should throw error when form does not exist', async () => {
        vi.mocked(prisma.form.findUnique).mockResolvedValue(null);

        await expect(
          checkFormAccess('user-123', 'nonexistent-form')
        ).rejects.toThrow(GraphQLError);
        await expect(
          checkFormAccess('user-123', 'nonexistent-form')
        ).rejects.toThrow('Form not found');
      });
    });

    describe('Organization membership check', () => {
      it('should deny access when user is not an organization member', async () => {
        const formWithNoUserMembership = {
          ...mockForm,
          organization: {
            ...mockForm.organization,
            members: [], // User is not a member
          },
        };
        vi.mocked(prisma.form.findUnique).mockResolvedValue(formWithNoUserMembership as any);

        const result = await checkFormAccess('user-123', 'form-123');

        expect(result.hasAccess).toBe(false);
        expect(result.permission).toBe(PermissionLevel.NO_ACCESS);
        expect(result.form).toEqual(formWithNoUserMembership);
      });

      it('should deny access even if user is form owner but not org member', async () => {
        const formWithNoUserMembership = {
          ...mockForm,
          createdById: 'user-123', // User IS the owner
          organization: {
            ...mockForm.organization,
            members: [], // But NOT an org member
          },
        };
        vi.mocked(prisma.form.findUnique).mockResolvedValue(formWithNoUserMembership as any);

        const result = await checkFormAccess('user-123', 'form-123');

        expect(result.hasAccess).toBe(false);
        expect(result.permission).toBe(PermissionLevel.NO_ACCESS);
      });
    });

    describe('Owner permissions', () => {
      it('should grant OWNER permission to form creator', async () => {
        vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);

        const result = await checkFormAccess('user-123', 'form-123');

        expect(result.hasAccess).toBe(true);
        expect(result.permission).toBe(PermissionLevel.OWNER);
        expect(result.form).toEqual(mockForm);
      });

      it('should grant OWNER permission regardless of required permission level', async () => {
        vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);

        const result = await checkFormAccess('user-123', 'form-123', PermissionLevel.EDITOR);

        expect(result.hasAccess).toBe(true);
        expect(result.permission).toBe(PermissionLevel.OWNER);
      });
    });

    describe('Explicit permissions', () => {
      it('should grant access with explicit VIEWER permission', async () => {
        const formWithPermissions = {
          ...mockForm,
          createdById: 'owner-999',
          organization: {
            ...mockForm.organization,
            members: [
              { userId: 'user-123', organizationId: 'org-123', role: 'member', user: mockContext.auth.user },
            ],
          },
          permissions: [
            {
              userId: 'user-123',
              formId: 'form-123',
              permission: PermissionLevel.VIEWER,
              grantedById: 'owner-999',
            },
          ],
        };
        vi.mocked(prisma.form.findUnique).mockResolvedValue(formWithPermissions as any);

        const result = await checkFormAccess('user-123', 'form-123', PermissionLevel.VIEWER);

        expect(result.hasAccess).toBe(true);
        expect(result.permission).toBe(PermissionLevel.VIEWER);
      });

      it('should grant access with explicit EDITOR permission', async () => {
        const formWithPermissions = {
          ...mockForm,
          createdById: 'owner-999',
          organization: {
            ...mockForm.organization,
            members: [
              { userId: 'user-123', organizationId: 'org-123', role: 'member', user: mockContext.auth.user },
            ],
          },
          permissions: [
            {
              userId: 'user-123',
              formId: 'form-123',
              permission: PermissionLevel.EDITOR,
              grantedById: 'owner-999',
            },
          ],
        };
        vi.mocked(prisma.form.findUnique).mockResolvedValue(formWithPermissions as any);

        const result = await checkFormAccess('user-123', 'form-123', PermissionLevel.EDITOR);

        expect(result.hasAccess).toBe(true);
        expect(result.permission).toBe(PermissionLevel.EDITOR);
      });

      it('should deny access when explicit permission is lower than required', async () => {
        const formWithPermissions = {
          ...mockForm,
          createdById: 'owner-999',
          organization: {
            ...mockForm.organization,
            members: [
              { userId: 'user-123', organizationId: 'org-123', role: 'member', user: mockContext.auth.user },
            ],
          },
          permissions: [
            {
              userId: 'user-123',
              formId: 'form-123',
              permission: PermissionLevel.VIEWER,
              grantedById: 'owner-999',
            },
          ],
        };
        vi.mocked(prisma.form.findUnique).mockResolvedValue(formWithPermissions as any);

        const result = await checkFormAccess('user-123', 'form-123', PermissionLevel.EDITOR);

        expect(result.hasAccess).toBe(false);
        expect(result.permission).toBe(PermissionLevel.VIEWER);
      });

      it('should allow EDITOR permission to satisfy VIEWER requirement', async () => {
        const formWithPermissions = {
          ...mockForm,
          createdById: 'owner-999',
          organization: {
            ...mockForm.organization,
            members: [
              { userId: 'user-123', organizationId: 'org-123', role: 'member', user: mockContext.auth.user },
            ],
          },
          permissions: [
            {
              userId: 'user-123',
              formId: 'form-123',
              permission: PermissionLevel.EDITOR,
              grantedById: 'owner-999',
            },
          ],
        };
        vi.mocked(prisma.form.findUnique).mockResolvedValue(formWithPermissions as any);

        const result = await checkFormAccess('user-123', 'form-123', PermissionLevel.VIEWER);

        expect(result.hasAccess).toBe(true);
        expect(result.permission).toBe(PermissionLevel.EDITOR);
      });
    });

    describe('Sharing scope - ALL_ORG_MEMBERS', () => {
      it('should grant access to all org members when sharingScope is ALL_ORG_MEMBERS', async () => {
        const formWithOrgSharing = {
          ...mockForm,
          createdById: 'owner-999',
          sharingScope: SharingScope.ALL_ORG_MEMBERS,
          defaultPermission: PermissionLevel.VIEWER,
          organization: {
            ...mockForm.organization,
            members: [
              { userId: 'user-123', organizationId: 'org-123', role: 'member', user: mockContext.auth.user },
            ],
          },
          permissions: [],
        };
        vi.mocked(prisma.form.findUnique).mockResolvedValue(formWithOrgSharing as any);

        const result = await checkFormAccess('user-123', 'form-123', PermissionLevel.VIEWER);

        expect(result.hasAccess).toBe(true);
        expect(result.permission).toBe(PermissionLevel.VIEWER);
      });

      it('should grant EDITOR access when defaultPermission is EDITOR', async () => {
        const formWithOrgSharing = {
          ...mockForm,
          createdById: 'owner-999',
          sharingScope: SharingScope.ALL_ORG_MEMBERS,
          defaultPermission: PermissionLevel.EDITOR,
          organization: {
            ...mockForm.organization,
            members: [
              { userId: 'user-123', organizationId: 'org-123', role: 'member', user: mockContext.auth.user },
            ],
          },
          permissions: [],
        };
        vi.mocked(prisma.form.findUnique).mockResolvedValue(formWithOrgSharing as any);

        const result = await checkFormAccess('user-123', 'form-123', PermissionLevel.EDITOR);

        expect(result.hasAccess).toBe(true);
        expect(result.permission).toBe(PermissionLevel.EDITOR);
      });

      it('should deny access when defaultPermission is lower than required', async () => {
        const formWithOrgSharing = {
          ...mockForm,
          createdById: 'owner-999',
          sharingScope: SharingScope.ALL_ORG_MEMBERS,
          defaultPermission: PermissionLevel.VIEWER,
          organization: {
            ...mockForm.organization,
            members: [
              { userId: 'user-123', organizationId: 'org-123', role: 'member', user: mockContext.auth.user },
            ],
          },
          permissions: [],
        };
        vi.mocked(prisma.form.findUnique).mockResolvedValue(formWithOrgSharing as any);

        const result = await checkFormAccess('user-123', 'form-123', PermissionLevel.EDITOR);

        expect(result.hasAccess).toBe(false);
        expect(result.permission).toBe(PermissionLevel.VIEWER);
      });
    });

    describe('Sharing scope - PRIVATE and SPECIFIC_MEMBERS', () => {
      it('should deny access when sharingScope is PRIVATE without explicit permissions', async () => {
        const formPrivate = {
          ...mockForm,
          createdById: 'owner-999',
          sharingScope: SharingScope.PRIVATE,
          organization: {
            ...mockForm.organization,
            members: [
              { userId: 'user-123', organizationId: 'org-123', role: 'member', user: mockContext.auth.user },
            ],
          },
          permissions: [],
        };
        vi.mocked(prisma.form.findUnique).mockResolvedValue(formPrivate as any);

        const result = await checkFormAccess('user-123', 'form-123');

        expect(result.hasAccess).toBe(false);
        expect(result.permission).toBe(PermissionLevel.NO_ACCESS);
      });

      it('should deny access when sharingScope is SPECIFIC_MEMBERS without explicit permissions', async () => {
        const formSpecific = {
          ...mockForm,
          createdById: 'owner-999',
          sharingScope: SharingScope.SPECIFIC_MEMBERS,
          organization: {
            ...mockForm.organization,
            members: [
              { userId: 'user-123', organizationId: 'org-123', role: 'member', user: mockContext.auth.user },
            ],
          },
          permissions: [],
        };
        vi.mocked(prisma.form.findUnique).mockResolvedValue(formSpecific as any);

        const result = await checkFormAccess('user-123', 'form-123');

        expect(result.hasAccess).toBe(false);
        expect(result.permission).toBe(PermissionLevel.NO_ACCESS);
      });
    });

    describe('Permission hierarchy', () => {
      it('should respect NO_ACCESS < VIEWER < EDITOR < OWNER hierarchy', async () => {
        // Test each permission level against each requirement
        const testCases = [
          { userPerm: PermissionLevel.NO_ACCESS, requiredPerm: PermissionLevel.NO_ACCESS, expected: true },
          { userPerm: PermissionLevel.NO_ACCESS, requiredPerm: PermissionLevel.VIEWER, expected: false },
          { userPerm: PermissionLevel.NO_ACCESS, requiredPerm: PermissionLevel.EDITOR, expected: false },
          { userPerm: PermissionLevel.NO_ACCESS, requiredPerm: PermissionLevel.OWNER, expected: false },

          { userPerm: PermissionLevel.VIEWER, requiredPerm: PermissionLevel.NO_ACCESS, expected: true },
          { userPerm: PermissionLevel.VIEWER, requiredPerm: PermissionLevel.VIEWER, expected: true },
          { userPerm: PermissionLevel.VIEWER, requiredPerm: PermissionLevel.EDITOR, expected: false },
          { userPerm: PermissionLevel.VIEWER, requiredPerm: PermissionLevel.OWNER, expected: false },

          { userPerm: PermissionLevel.EDITOR, requiredPerm: PermissionLevel.NO_ACCESS, expected: true },
          { userPerm: PermissionLevel.EDITOR, requiredPerm: PermissionLevel.VIEWER, expected: true },
          { userPerm: PermissionLevel.EDITOR, requiredPerm: PermissionLevel.EDITOR, expected: true },
          { userPerm: PermissionLevel.EDITOR, requiredPerm: PermissionLevel.OWNER, expected: false },

          { userPerm: PermissionLevel.OWNER, requiredPerm: PermissionLevel.NO_ACCESS, expected: true },
          { userPerm: PermissionLevel.OWNER, requiredPerm: PermissionLevel.VIEWER, expected: true },
          { userPerm: PermissionLevel.OWNER, requiredPerm: PermissionLevel.EDITOR, expected: true },
          { userPerm: PermissionLevel.OWNER, requiredPerm: PermissionLevel.OWNER, expected: true },
        ];

        for (const testCase of testCases) {
          const formWithPermission = {
            ...mockForm,
            createdById: 'owner-999',
            organization: {
              ...mockForm.organization,
              members: [
                { userId: 'user-123', organizationId: 'org-123', role: 'member', user: mockContext.auth.user },
              ],
            },
            permissions: [
              {
                userId: 'user-123',
                formId: 'form-123',
                permission: testCase.userPerm,
                grantedById: 'owner-999',
              },
            ],
          };
          vi.mocked(prisma.form.findUnique).mockResolvedValue(formWithPermission as any);

          const result = await checkFormAccess('user-123', 'form-123', testCase.requiredPerm);

          expect(result.hasAccess).toBe(testCase.expected);
          expect(result.permission).toBe(testCase.userPerm);
        }
      });
    });
  });

  describe('Query: formPermissions', () => {
    it('should return form permissions when user has EDITOR access', async () => {
      const mockPermissions = [
        {
          id: 'perm-1',
          formId: 'form-123',
          userId: 'user-456',
          permission: PermissionLevel.VIEWER,
          grantedById: 'user-123',
          grantedAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          user: mockUser2,
          grantedBy: mockContext.auth.user,
        },
      ];

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        ...mockForm,
        organization: {
          ...mockForm.organization,
          members: [mockForm.organization.members[0]],
        },
      } as any);
      vi.mocked(prisma.formPermission.findMany).mockResolvedValue(mockPermissions as any);

      const result = await formSharingResolvers.Query.formPermissions(
        {},
        { formId: 'form-123' },
        mockContext
      );

      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(prisma.formPermission.findMany).toHaveBeenCalledWith({
        where: { formId: 'form-123' },
        include: {
          user: true,
          grantedBy: true,
        },
        orderBy: { grantedAt: 'desc' },
      });
      expect(result).toEqual(mockPermissions);
    });

    it('should throw error when user lacks EDITOR access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        ...mockForm,
        createdById: 'owner-999',
        organization: {
          ...mockForm.organization,
          members: [mockForm.organization.members[0]],
        },
        permissions: [],
      } as any);

      await expect(
        formSharingResolvers.Query.formPermissions({}, { formId: 'form-123' }, mockContext)
      ).rejects.toThrow(GraphQLError);
      await expect(
        formSharingResolvers.Query.formPermissions({}, { formId: 'form-123' }, mockContext)
      ).rejects.toThrow('Access denied: Insufficient permissions');
    });

    it('should throw error when user is not authenticated', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new Error('Authentication required');
      });

      await expect(
        formSharingResolvers.Query.formPermissions({}, { formId: 'form-123' }, mockContext)
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Query: forms', () => {
    const baseFormsArgs = {
      organizationId: 'org-123',
      category: 'ALL',
      page: 1,
      limit: 10,
    };

    beforeEach(() => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue({
        role: 'member',
      });
    });

    describe('Category filtering', () => {
      it('should return owner forms when category is OWNER', async () => {
        const ownerForms = [mockForm];
        vi.mocked(prisma.form.count).mockResolvedValue(1);
        vi.mocked(prisma.form.findMany).mockResolvedValue(ownerForms as any);

        const result = await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, category: 'OWNER' },
          mockContext
        );

        expect(prisma.form.count).toHaveBeenCalledWith({
          where: {
            organizationId: 'org-123',
            createdById: 'user-123',
          },
        });
        expect(result.forms).toEqual(ownerForms);
        expect(result.totalCount).toBe(1);
      });

      it('should return shared forms when category is SHARED', async () => {
        const sharedForm = { ...mockForm, id: 'form-456', createdById: 'owner-999' };
        vi.mocked(prisma.form.count).mockResolvedValue(1);
        vi.mocked(prisma.form.findMany).mockResolvedValue([sharedForm] as any);

        const result = await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, category: 'SHARED' },
          mockContext
        );

        expect(prisma.form.count).toHaveBeenCalledWith({
          where: {
            organizationId: 'org-123',
            createdById: { not: 'user-123' },
            AND: [
              {
                OR: [
                  {
                    permissions: {
                      some: {
                        userId: 'user-123',
                        permission: { not: PermissionLevel.NO_ACCESS },
                      },
                    },
                  },
                  {
                    sharingScope: SharingScope.ALL_ORG_MEMBERS,
                    defaultPermission: { not: PermissionLevel.NO_ACCESS },
                  },
                ],
              },
            ],
          },
        });
        expect(result.forms).toEqual([sharedForm]);
      });

      it('should return all forms when category is ALL', async () => {
        const allForms = [mockForm, { ...mockForm, id: 'form-456', createdById: 'owner-999' }];
        vi.mocked(prisma.form.count).mockResolvedValue(2);
        vi.mocked(prisma.form.findMany).mockResolvedValue(allForms as any);

        const result = await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, category: 'ALL' },
          mockContext
        );

        expect(result.forms).toEqual(allForms);
        expect(result.totalCount).toBe(2);
      });

      it('should throw error for invalid category', async () => {
        await expect(
          formSharingResolvers.Query.forms(
            {},
            { ...baseFormsArgs, category: 'INVALID' },
            mockContext
          )
        ).rejects.toThrow(GraphQLError);
        await expect(
          formSharingResolvers.Query.forms(
            {},
            { ...baseFormsArgs, category: 'INVALID' },
            mockContext
          )
        ).rejects.toThrow('Invalid category: INVALID. Must be OWNER, SHARED, or ALL');
      });
    });

    describe('Search filtering', () => {
      it('should filter forms by title search term', async () => {
        vi.mocked(prisma.form.count).mockResolvedValue(1);
        vi.mocked(prisma.form.findMany).mockResolvedValue([mockForm] as any);

        await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, filters: { search: 'Test' } },
          mockContext
        );

        expect(prisma.form.count).toHaveBeenCalledWith({
          where: expect.objectContaining({
            OR: [
              { createdById: 'user-123', AND: [{ OR: expect.any(Array) }] },
              expect.any(Object),
            ],
          }),
        });
      });

      it('should filter OWNER category with search term', async () => {
        vi.mocked(prisma.form.count).mockResolvedValue(1);
        vi.mocked(prisma.form.findMany).mockResolvedValue([mockForm] as any);

        await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, category: 'OWNER', filters: { search: 'Test' } },
          mockContext
        );

        expect(prisma.form.count).toHaveBeenCalledWith({
          where: {
            organizationId: 'org-123',
            createdById: 'user-123',
            AND: [
              {
                OR: [
                  { title: { contains: 'Test', mode: 'insensitive' } },
                  { description: { contains: 'Test', mode: 'insensitive' } },
                ],
              },
            ],
          },
        });
      });

      it('should filter SHARED category with search term', async () => {
        vi.mocked(prisma.form.count).mockResolvedValue(1);
        vi.mocked(prisma.form.findMany).mockResolvedValue([mockForm] as any);

        await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, category: 'SHARED', filters: { search: 'Form' } },
          mockContext
        );

        expect(prisma.form.count).toHaveBeenCalledWith({
          where: {
            organizationId: 'org-123',
            createdById: { not: 'user-123' },
            AND: [
              {
                OR: [
                  {
                    permissions: {
                      some: {
                        userId: 'user-123',
                        permission: { not: PermissionLevel.NO_ACCESS },
                      },
                    },
                  },
                  {
                    sharingScope: SharingScope.ALL_ORG_MEMBERS,
                    defaultPermission: { not: PermissionLevel.NO_ACCESS },
                  },
                ],
              },
              {
                OR: [
                  { title: { contains: 'Form', mode: 'insensitive' } },
                  { description: { contains: 'Form', mode: 'insensitive' } },
                ],
              },
            ],
          },
        });
      });

      it('should filter forms by description search term', async () => {
        vi.mocked(prisma.form.count).mockResolvedValue(1);
        vi.mocked(prisma.form.findMany).mockResolvedValue([mockForm] as any);

        await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, filters: { search: 'Description' } },
          mockContext
        );

        expect(prisma.form.count).toHaveBeenCalled();
        expect(prisma.form.findMany).toHaveBeenCalled();
      });

      it('should handle empty search term', async () => {
        vi.mocked(prisma.form.count).mockResolvedValue(1);
        vi.mocked(prisma.form.findMany).mockResolvedValue([mockForm] as any);

        await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, filters: { search: '   ' } },
          mockContext
        );

        expect(prisma.form.count).toHaveBeenCalled();
        expect(prisma.form.findMany).toHaveBeenCalled();
      });
    });

    describe('Pagination', () => {
      it('should return paginated results with correct metadata', async () => {
        vi.mocked(prisma.form.count).mockResolvedValue(25);
        vi.mocked(prisma.form.findMany).mockResolvedValue([mockForm] as any);

        const result = await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, page: 2, limit: 10 },
          mockContext
        );

        expect(result.page).toBe(2);
        expect(result.limit).toBe(10);
        expect(result.totalCount).toBe(25);
        expect(result.totalPages).toBe(3);
        expect(result.hasNextPage).toBe(true);
        expect(result.hasPreviousPage).toBe(true);
        expect(prisma.form.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 10,
            take: 10,
          })
        );
      });

      it('should handle first page pagination', async () => {
        vi.mocked(prisma.form.count).mockResolvedValue(25);
        vi.mocked(prisma.form.findMany).mockResolvedValue([mockForm] as any);

        const result = await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, page: 1, limit: 10 },
          mockContext
        );

        expect(result.hasPreviousPage).toBe(false);
        expect(result.hasNextPage).toBe(true);
      });

      it('should handle last page pagination', async () => {
        vi.mocked(prisma.form.count).mockResolvedValue(25);
        vi.mocked(prisma.form.findMany).mockResolvedValue([mockForm] as any);

        const result = await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, page: 3, limit: 10 },
          mockContext
        );

        expect(result.hasPreviousPage).toBe(true);
        expect(result.hasNextPage).toBe(false);
      });

      it('should enforce maximum limit of 100', async () => {
        vi.mocked(prisma.form.count).mockResolvedValue(150);
        vi.mocked(prisma.form.findMany).mockResolvedValue([mockForm] as any);

        await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, limit: 500 },
          mockContext
        );

        expect(prisma.form.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 100,
          })
        );
      });

      it('should enforce minimum page of 1', async () => {
        vi.mocked(prisma.form.count).mockResolvedValue(10);
        vi.mocked(prisma.form.findMany).mockResolvedValue([mockForm] as any);

        const result = await formSharingResolvers.Query.forms(
          {},
          { ...baseFormsArgs, page: -5 },
          mockContext
        );

        expect(result.page).toBe(1);
      });
    });

    it('should verify organization membership before querying', async () => {
      vi.mocked(prisma.form.count).mockResolvedValue(0);
      vi.mocked(prisma.form.findMany).mockResolvedValue([]);

      await formSharingResolvers.Query.forms({}, baseFormsArgs, mockContext);

      expect(betterAuthMiddleware.requireOrganizationMembership).toHaveBeenCalledWith(
        mockContext.auth,
        'org-123'
      );
    });

    it('should throw error when user is not org member', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockImplementation(() => {
        throw new GraphQLError('Access denied: You are not a member of this organization');
      });

      await expect(
        formSharingResolvers.Query.forms({}, baseFormsArgs, mockContext)
      ).rejects.toThrow('Access denied: You are not a member of this organization');
    });
  });

  describe('Query: organizationMembers', () => {
    const mockMembers = [
      {
        id: 'member-1',
        userId: 'user-123',
        organizationId: 'org-123',
        role: 'owner',
        user: mockContext.auth.user,
      },
      {
        id: 'member-2',
        userId: 'user-456',
        organizationId: 'org-123',
        role: 'member',
        user: mockUser2,
      },
    ];

    it('should return organization members when user is member', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue({ role: 'member' });
      vi.mocked(prisma.member.findMany).mockResolvedValue(mockMembers as any);

      const result = await formSharingResolvers.Query.organizationMembers(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(betterAuthMiddleware.requireOrganizationMembership).toHaveBeenCalledWith(
        mockContext.auth,
        'org-123'
      );
      expect(prisma.member.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        include: { user: true },
        orderBy: { user: { name: 'asc' } },
      });
      expect(result).toEqual([mockContext.auth.user, mockUser2]);
    });

    it('should throw error when user is not org member', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockImplementation(() => {
        throw new GraphQLError('Access denied: You are not a member of this organization');
      });

      await expect(
        formSharingResolvers.Query.organizationMembers(
          {},
          { organizationId: 'org-123' },
          mockContext
        )
      ).rejects.toThrow('Access denied: You are not a member of this organization');
    });
  });

  describe('Mutation: shareForm', () => {
    const shareFormInput = {
      formId: 'form-123',
      sharingScope: SharingScope.ALL_ORG_MEMBERS,
      defaultPermission: PermissionLevel.VIEWER,
    };

    it('should update form sharing scope and default permission', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.form.update).mockResolvedValue({
        ...mockForm,
        sharingScope: SharingScope.ALL_ORG_MEMBERS,
        defaultPermission: PermissionLevel.VIEWER,
      } as any);
      vi.mocked(prisma.formPermission.findMany).mockResolvedValue([]);

      const result = await formSharingResolvers.Mutation.shareForm(
        {},
        { input: shareFormInput },
        mockContext
      );

      expect(prisma.form.update).toHaveBeenCalledWith({
        where: { id: 'form-123' },
        data: {
          sharingScope: SharingScope.ALL_ORG_MEMBERS,
          defaultPermission: PermissionLevel.VIEWER,
        },
      });
      expect(result.sharingScope).toBe(SharingScope.ALL_ORG_MEMBERS);
      expect(result.defaultPermission).toBe(PermissionLevel.VIEWER);
    });

    it('should create user-specific permissions', async () => {
      const inputWithPermissions = {
        ...shareFormInput,
        userPermissions: [
          { userId: 'user-456', permission: PermissionLevel.EDITOR },
          { userId: 'user-789', permission: PermissionLevel.VIEWER },
        ],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.form.update).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.member.findMany).mockResolvedValue([
        { userId: 'user-456', organizationId: 'org-123' },
        { userId: 'user-789', organizationId: 'org-123' },
      ] as any);
      vi.mocked(prisma.formPermission.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.formPermission.createMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.formPermission.findMany).mockResolvedValue([]);

      await formSharingResolvers.Mutation.shareForm(
        {},
        { input: inputWithPermissions },
        mockContext
      );

      expect(prisma.member.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-123',
          userId: { in: ['user-456', 'user-789'] },
        },
        select: { userId: true },
      });
      expect(prisma.formPermission.deleteMany).toHaveBeenCalledWith({
        where: {
          formId: 'form-123',
          userId: { in: ['user-456', 'user-789'] },
        },
      });
      expect(prisma.formPermission.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            formId: 'form-123',
            userId: 'user-456',
            permission: PermissionLevel.EDITOR,
            grantedById: 'user-123',
          }),
          expect.objectContaining({
            formId: 'form-123',
            userId: 'user-789',
            permission: PermissionLevel.VIEWER,
            grantedById: 'user-123',
          }),
        ],
      });
    });

    it('should skip NO_ACCESS permissions when creating', async () => {
      const inputWithNoAccess = {
        ...shareFormInput,
        userPermissions: [
          { userId: 'user-456', permission: PermissionLevel.EDITOR },
          { userId: 'user-789', permission: PermissionLevel.NO_ACCESS },
        ],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.form.update).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.member.findMany).mockResolvedValue([
        { userId: 'user-456', organizationId: 'org-123' },
        { userId: 'user-789', organizationId: 'org-123' },
      ] as any);
      vi.mocked(prisma.formPermission.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.formPermission.createMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.formPermission.findMany).mockResolvedValue([]);

      await formSharingResolvers.Mutation.shareForm(
        {},
        { input: inputWithNoAccess },
        mockContext
      );

      expect(prisma.formPermission.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: 'user-456',
            permission: PermissionLevel.EDITOR,
          }),
        ],
      });
    });

    it('should not call createMany when all permissions are NO_ACCESS', async () => {
      const inputWithAllNoAccess = {
        ...shareFormInput,
        userPermissions: [
          { userId: 'user-456', permission: PermissionLevel.NO_ACCESS },
          { userId: 'user-789', permission: PermissionLevel.NO_ACCESS },
        ],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.form.update).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.member.findMany).mockResolvedValue([
        { userId: 'user-456', organizationId: 'org-123' },
        { userId: 'user-789', organizationId: 'org-123' },
      ] as any);
      vi.mocked(prisma.formPermission.deleteMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.formPermission.findMany).mockResolvedValue([]);

      await formSharingResolvers.Mutation.shareForm(
        {},
        { input: inputWithAllNoAccess },
        mockContext
      );

      expect(prisma.formPermission.deleteMany).toHaveBeenCalled();
      expect(prisma.formPermission.createMany).not.toHaveBeenCalled();
    });

    it('should throw error when user is not org member', async () => {
      const inputWithInvalidUser = {
        ...shareFormInput,
        userPermissions: [{ userId: 'external-user', permission: PermissionLevel.VIEWER }],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.member.findMany).mockResolvedValue([]);

      await expect(
        formSharingResolvers.Mutation.shareForm({}, { input: inputWithInvalidUser }, mockContext)
      ).rejects.toThrow(GraphQLError);
      await expect(
        formSharingResolvers.Mutation.shareForm({}, { input: inputWithInvalidUser }, mockContext)
      ).rejects.toThrow('Cannot grant permissions to users outside organization: external-user');
    });

    it('should throw error when user lacks EDITOR permission', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        ...mockForm,
        createdById: 'owner-999',
        organization: {
          ...mockForm.organization,
          members: [mockForm.organization.members[0]],
        },
        permissions: [],
      } as any);

      await expect(
        formSharingResolvers.Mutation.shareForm({}, { input: shareFormInput }, mockContext)
      ).rejects.toThrow(GraphQLError);
      await expect(
        formSharingResolvers.Mutation.shareForm({}, { input: shareFormInput }, mockContext)
      ).rejects.toThrow('Access denied: Insufficient permissions to share this form');
    });

    it('should default to VIEWER permission when not specified', async () => {
      const inputWithoutDefaultPermission = {
        formId: 'form-123',
        sharingScope: SharingScope.ALL_ORG_MEMBERS,
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.form.update).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.formPermission.findMany).mockResolvedValue([]);

      await formSharingResolvers.Mutation.shareForm(
        {},
        { input: inputWithoutDefaultPermission },
        mockContext
      );

      expect(prisma.form.update).toHaveBeenCalledWith({
        where: { id: 'form-123' },
        data: {
          sharingScope: SharingScope.ALL_ORG_MEMBERS,
          defaultPermission: PermissionLevel.VIEWER,
        },
      });
    });
  });

  describe('Mutation: updateFormPermission', () => {
    const updatePermissionInput = {
      formId: 'form-123',
      userId: 'user-456',
      permission: PermissionLevel.EDITOR,
    };

    it('should update existing permission', async () => {
      const updatedPermission = {
        id: 'perm-1',
        formId: 'form-123',
        userId: 'user-456',
        permission: PermissionLevel.EDITOR,
        grantedById: 'user-123',
        grantedAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        user: mockUser2,
        grantedBy: mockContext.auth.user,
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.member.findFirst).mockResolvedValue({
        userId: 'user-456',
        organizationId: 'org-123',
        role: 'member',
      } as any);
      vi.mocked(prisma.formPermission.upsert).mockResolvedValue(updatedPermission as any);

      const result = await formSharingResolvers.Mutation.updateFormPermission(
        {},
        { input: updatePermissionInput },
        mockContext
      );

      expect(prisma.formPermission.upsert).toHaveBeenCalledWith({
        where: {
          formId_userId: {
            formId: 'form-123',
            userId: 'user-456',
          },
        },
        update: {
          permission: PermissionLevel.EDITOR,
          grantedById: 'user-123',
        },
        create: expect.objectContaining({
          formId: 'form-123',
          userId: 'user-456',
          permission: PermissionLevel.EDITOR,
          grantedById: 'user-123',
        }),
        include: {
          user: true,
          grantedBy: true,
        },
      });
      expect(result).toEqual(updatedPermission);
    });

    it('should remove permission when permission is NO_ACCESS', async () => {
      const removePermissionInput = {
        ...updatePermissionInput,
        permission: PermissionLevel.NO_ACCESS,
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.member.findFirst).mockResolvedValue({
        userId: 'user-456',
        organizationId: 'org-123',
        role: 'member',
      } as any);
      vi.mocked(prisma.formPermission.deleteMany).mockResolvedValue({ count: 1 });

      const result = await formSharingResolvers.Mutation.updateFormPermission(
        {},
        { input: removePermissionInput },
        mockContext
      );

      expect(prisma.formPermission.deleteMany).toHaveBeenCalledWith({
        where: {
          formId: 'form-123',
          userId: 'user-456',
        },
      });
      expect(result.permission).toBe(PermissionLevel.NO_ACCESS);
      expect(result.user).toBeNull();
    });

    it('should throw error when target user is not org member', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.member.findFirst).mockResolvedValue(null);

      await expect(
        formSharingResolvers.Mutation.updateFormPermission(
          {},
          { input: updatePermissionInput },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        formSharingResolvers.Mutation.updateFormPermission(
          {},
          { input: updatePermissionInput },
          mockContext
        )
      ).rejects.toThrow('Cannot grant permissions to users outside organization');
    });

    it('should throw error when trying to change owner permissions', async () => {
      const ownerPermissionInput = {
        formId: 'form-123',
        userId: 'user-123',
        permission: PermissionLevel.VIEWER,
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.member.findFirst).mockResolvedValue({
        userId: 'user-123',
        organizationId: 'org-123',
        role: 'owner',
      } as any);

      await expect(
        formSharingResolvers.Mutation.updateFormPermission(
          {},
          { input: ownerPermissionInput },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        formSharingResolvers.Mutation.updateFormPermission(
          {},
          { input: ownerPermissionInput },
          mockContext
        )
      ).rejects.toThrow('Cannot change permissions for form owner');
    });

    it('should throw error when user lacks EDITOR access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        ...mockForm,
        createdById: 'owner-999',
        organization: {
          ...mockForm.organization,
          members: [mockForm.organization.members[0]],
        },
        permissions: [],
      } as any);

      await expect(
        formSharingResolvers.Mutation.updateFormPermission(
          {},
          { input: updatePermissionInput },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        formSharingResolvers.Mutation.updateFormPermission(
          {},
          { input: updatePermissionInput },
          mockContext
        )
      ).rejects.toThrow('Access denied: Insufficient permissions');
    });
  });

  describe('Mutation: removeFormAccess', () => {
    it('should remove user access to form', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.formPermission.deleteMany).mockResolvedValue({ count: 1 });

      const result = await formSharingResolvers.Mutation.removeFormAccess(
        {},
        { formId: 'form-123', userId: 'user-456' },
        mockContext
      );

      expect(prisma.formPermission.deleteMany).toHaveBeenCalledWith({
        where: {
          formId: 'form-123',
          userId: 'user-456',
        },
      });
      expect(result).toBe(true);
    });

    it('should return false when no permission found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);
      vi.mocked(prisma.formPermission.deleteMany).mockResolvedValue({ count: 0 });

      const result = await formSharingResolvers.Mutation.removeFormAccess(
        {},
        { formId: 'form-123', userId: 'user-456' },
        mockContext
      );

      expect(result).toBe(false);
    });

    it('should throw error when trying to remove owner access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);

      await expect(
        formSharingResolvers.Mutation.removeFormAccess(
          {},
          { formId: 'form-123', userId: 'user-123' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        formSharingResolvers.Mutation.removeFormAccess(
          {},
          { formId: 'form-123', userId: 'user-123' },
          mockContext
        )
      ).rejects.toThrow('Cannot remove access from form owner');
    });

    it('should throw error when user lacks EDITOR access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        ...mockForm,
        createdById: 'owner-999',
        organization: {
          ...mockForm.organization,
          members: [mockForm.organization.members[0]],
        },
        permissions: [],
      } as any);

      await expect(
        formSharingResolvers.Mutation.removeFormAccess(
          {},
          { formId: 'form-123', userId: 'user-456' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        formSharingResolvers.Mutation.removeFormAccess(
          {},
          { formId: 'form-123', userId: 'user-456' },
          mockContext
        )
      ).rejects.toThrow('Access denied: Insufficient permissions');
    });
  });

  describe('Form field resolvers', () => {
    describe('Form.permissions', () => {
      it('should return form permissions', async () => {
        const mockPermissions = [
          {
            id: 'perm-1',
            formId: 'form-123',
            userId: 'user-456',
            permission: PermissionLevel.VIEWER,
            grantedById: 'user-123',
            grantedAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
            user: mockUser2,
            grantedBy: mockContext.auth.user,
          },
        ];
        vi.mocked(prisma.formPermission.findMany).mockResolvedValue(mockPermissions as any);

        const result = await formSharingResolvers.Form.permissions({ id: 'form-123' });

        expect(prisma.formPermission.findMany).toHaveBeenCalledWith({
          where: { formId: 'form-123' },
          include: {
            user: true,
            grantedBy: true,
          },
          orderBy: { grantedAt: 'desc' },
        });
        expect(result).toEqual(mockPermissions);
      });
    });

    describe('Form.userPermission', () => {
      it('should return user permission for authenticated user', async () => {
        vi.mocked(prisma.form.findUnique).mockResolvedValue(mockForm as any);

        const result = await formSharingResolvers.Form.userPermission(
          { id: 'form-123' },
          {},
          mockContext
        );

        expect(result).toBe(PermissionLevel.OWNER);
      });

      it('should return null when user is not authenticated', async () => {
        const unauthContext = { auth: { user: null } };

        const result = await formSharingResolvers.Form.userPermission(
          { id: 'form-123' },
          {},
          unauthContext
        );

        expect(result).toBeNull();
      });
    });

    describe('Form.category', () => {
      it('should return OWNER for forms created by user', () => {
        const result = formSharingResolvers.Form.category(
          { id: 'form-123', createdById: 'user-123' },
          {},
          mockContext
        );

        expect(result).toBe('OWNER');
      });

      it('should return SHARED for forms not created by user', () => {
        const result = formSharingResolvers.Form.category(
          { id: 'form-123', createdById: 'owner-999' },
          {},
          mockContext
        );

        expect(result).toBe('SHARED');
      });

      it('should return null when user is not authenticated', () => {
        const unauthContext = { auth: { user: null } };

        const result = formSharingResolvers.Form.category(
          { id: 'form-123', createdById: 'user-123' },
          {},
          unauthContext
        );

        expect(result).toBeNull();
      });

      it('should return null when createdById is missing', () => {
        const result = formSharingResolvers.Form.category(
          { id: 'form-123' },
          {},
          mockContext
        );

        expect(result).toBeNull();
      });
    });
  });

  describe('FormPermission field resolvers', () => {
    const mockPermission = {
      id: 'perm-123',
      formId: 'form-123',
      userId: 'user-456',
      permission: PermissionLevel.EDITOR,
      grantedById: 'user-123',
      grantedAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-02T10:00:00Z'),
      user: mockUser2,
      grantedBy: mockContext.auth.user,
    };

    it('should resolve id field', () => {
      const result = formSharingResolvers.FormPermission.id(mockPermission);
      expect(result).toBe('perm-123');
    });

    it('should resolve formId field', () => {
      const result = formSharingResolvers.FormPermission.formId(mockPermission);
      expect(result).toBe('form-123');
    });

    it('should resolve userId field', () => {
      const result = formSharingResolvers.FormPermission.userId(mockPermission);
      expect(result).toBe('user-456');
    });

    it('should resolve user field', () => {
      const result = formSharingResolvers.FormPermission.user(mockPermission);
      expect(result).toEqual(mockUser2);
    });

    it('should resolve permission field', () => {
      const result = formSharingResolvers.FormPermission.permission(mockPermission);
      expect(result).toBe(PermissionLevel.EDITOR);
    });

    it('should resolve grantedBy field', () => {
      const result = formSharingResolvers.FormPermission.grantedBy(mockPermission);
      expect(result).toEqual(mockContext.auth.user);
    });

    it('should resolve grantedAt field as ISO string', () => {
      const result = formSharingResolvers.FormPermission.grantedAt(mockPermission);
      expect(result).toBe('2024-01-01T10:00:00.000Z');
    });

    it('should resolve updatedAt field as ISO string', () => {
      const result = formSharingResolvers.FormPermission.updatedAt(mockPermission);
      expect(result).toBe('2024-01-02T10:00:00.000Z');
    });
  });
});
