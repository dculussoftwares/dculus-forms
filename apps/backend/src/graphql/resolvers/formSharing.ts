import { prisma } from '../../lib/prisma.js';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { randomUUID } from 'crypto';
import { GraphQLError } from 'graphql';

// Permission levels mapping
export const PermissionLevel = {
  OWNER: 'OWNER',
  EDITOR: 'EDITOR', 
  VIEWER: 'VIEWER',
  NO_ACCESS: 'NO_ACCESS'
} as const;

// Sharing scopes mapping
export const SharingScope = {
  PRIVATE: 'PRIVATE',
  SPECIFIC_MEMBERS: 'SPECIFIC_MEMBERS',
  ALL_ORG_MEMBERS: 'ALL_ORG_MEMBERS'
} as const;

type Permission = typeof PermissionLevel[keyof typeof PermissionLevel];
type Scope = typeof SharingScope[keyof typeof SharingScope];

// Helper function to check if user has permission to access form
export const checkFormAccess = async (userId: string, formId: string, requiredPermission: Permission = PermissionLevel.VIEWER) => {
  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: {
      createdBy: true,
      permissions: {
        include: {
          user: true,
          grantedBy: true
        }
      },
      organization: {
        include: {
          members: {
            where: { userId },
            include: { user: true }
          }
        }
      }
    }
  });

  if (!form) {
    throw new GraphQLError('Form not found');
  }

  // Check if user is the form owner
  if (form.createdById === userId) {
    return { hasAccess: true, permission: PermissionLevel.OWNER, form };
  }

  // Check if user is a member of the form's organization
  const userMembership = form.organization.members.find(member => member.userId === userId);
  if (!userMembership) {
    // No access if user is not a member of the organization
    return { hasAccess: false, permission: PermissionLevel.NO_ACCESS, form };
  }

  // Check explicit permissions
  const explicitPermission = form.permissions.find(p => p.userId === userId);
  if (explicitPermission) {
    const hasRequiredAccess = checkPermissionLevel(explicitPermission.permission as Permission, requiredPermission);
    return { 
      hasAccess: hasRequiredAccess, 
      permission: explicitPermission.permission as Permission, 
      form 
    };
  }

  // Check sharing scope for organization members
  if (form.sharingScope === SharingScope.ALL_ORG_MEMBERS) {
    const hasRequiredAccess = checkPermissionLevel(form.defaultPermission as Permission, requiredPermission);
    return { 
      hasAccess: hasRequiredAccess, 
      permission: form.defaultPermission as Permission, 
      form 
    };
  }

  // Default: no access
  return { hasAccess: false, permission: PermissionLevel.NO_ACCESS, form };
};

// Helper to compare permission levels
const checkPermissionLevel = (userPermission: Permission, requiredPermission: Permission): boolean => {
  const permissionHierarchy = {
    [PermissionLevel.NO_ACCESS]: 0,
    [PermissionLevel.VIEWER]: 1,
    [PermissionLevel.EDITOR]: 2,
    [PermissionLevel.OWNER]: 3
  };

  return permissionHierarchy[userPermission] >= permissionHierarchy[requiredPermission];
};

export const formSharingResolvers = {
  Query: {
    formPermissions: async (_: any, { formId }: { formId: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      
      // Check if user has access to manage permissions (must be owner or editor)
      const accessCheck = await checkFormAccess(context.auth.user!.id, formId, PermissionLevel.EDITOR);
      if (!accessCheck.hasAccess) {
        throw new GraphQLError('Access denied: Insufficient permissions');
      }

      return await prisma.formPermission.findMany({
        where: { formId },
        include: {
          user: true,
          grantedBy: true
        },
        orderBy: { grantedAt: 'desc' }
      });
    },

    accessibleForms: async (_: any, { organizationId }: { organizationId: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      const userId = context.auth.user!.id;

      // Get all forms in the organization where the user has access
      const forms = await prisma.form.findMany({
        where: {
          organizationId,
          OR: [
            // Forms owned by the user
            { createdById: userId },
            // Forms with explicit permissions for the user
            { 
              permissions: {
                some: {
                  userId,
                  permission: { not: PermissionLevel.NO_ACCESS }
                }
              }
            },
            // Forms shared with all organization members
            {
              sharingScope: SharingScope.ALL_ORG_MEMBERS,
              defaultPermission: { not: PermissionLevel.NO_ACCESS }
            }
          ]
        },
        include: {
          organization: true,
          createdBy: true,
          permissions: {
            include: {
              user: true,
              grantedBy: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return forms;
    },

    organizationMembers: async (_: any, { organizationId }: { organizationId: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      // Check if user is a member of the organization
      const membership = await prisma.member.findFirst({
        where: {
          organizationId,
          userId: context.auth.user!.id
        }
      });

      if (!membership) {
        throw new GraphQLError('Access denied: Not a member of this organization');
      }

      const members = await prisma.member.findMany({
        where: { organizationId },
        include: { user: true },
        orderBy: { user: { name: 'asc' } }
      });

      return members.map(member => member.user);
    }
  },

  Mutation: {
    shareForm: async (
      _: any,
      { input }: { input: { formId: string; sharingScope: Scope; defaultPermission?: Permission; userPermissions?: Array<{ userId: string; permission: Permission }> } },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const userId = context.auth.user!.id;

      // Check if user has permission to share the form (must be owner or editor)
      const accessCheck = await checkFormAccess(userId, input.formId, PermissionLevel.EDITOR);
      if (!accessCheck.hasAccess) {
        throw new GraphQLError('Access denied: Insufficient permissions to share this form');
      }

      // Update form sharing settings
      const updatedForm = await prisma.form.update({
        where: { id: input.formId },
        data: {
          sharingScope: input.sharingScope,
          defaultPermission: input.defaultPermission || PermissionLevel.VIEWER
        }
      });

      // Handle user-specific permissions
      if (input.userPermissions && input.userPermissions.length > 0) {
        // Remove existing permissions for these users
        const userIds = input.userPermissions.map(up => up.userId);
        await prisma.formPermission.deleteMany({
          where: {
            formId: input.formId,
            userId: { in: userIds }
          }
        });

        // Add new permissions
        const permissionsToCreate = input.userPermissions
          .filter(up => up.permission !== PermissionLevel.NO_ACCESS)
          .map(up => ({
            id: randomUUID(),
            formId: input.formId,
            userId: up.userId,
            permission: up.permission,
            grantedById: userId
          }));

        if (permissionsToCreate.length > 0) {
          await prisma.formPermission.createMany({
            data: permissionsToCreate
          });
        }
      }

      // Return the updated sharing settings
      const permissions = await prisma.formPermission.findMany({
        where: { formId: input.formId },
        include: {
          user: true,
          grantedBy: true
        }
      });

      return {
        sharingScope: updatedForm.sharingScope,
        defaultPermission: updatedForm.defaultPermission,
        permissions
      };
    },

    updateFormPermission: async (
      _: any,
      { input }: { input: { formId: string; userId: string; permission: Permission } },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const grantedById = context.auth.user!.id;

      // Check if user has permission to manage permissions
      const accessCheck = await checkFormAccess(grantedById, input.formId, PermissionLevel.EDITOR);
      if (!accessCheck.hasAccess) {
        throw new GraphQLError('Access denied: Insufficient permissions');
      }

      // Prevent users from changing owner permissions
      if (accessCheck.form.createdById === input.userId) {
        throw new GraphQLError('Cannot change permissions for form owner');
      }

      // Remove access if permission is NO_ACCESS
      if (input.permission === PermissionLevel.NO_ACCESS) {
        await prisma.formPermission.deleteMany({
          where: {
            formId: input.formId,
            userId: input.userId
          }
        });
        
        return {
          id: '',
          formId: input.formId,
          userId: input.userId,
          permission: PermissionLevel.NO_ACCESS,
          grantedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: null,
          grantedBy: null
        };
      }

      // Upsert permission
      const permission = await prisma.formPermission.upsert({
        where: {
          formId_userId: {
            formId: input.formId,
            userId: input.userId
          }
        },
        update: {
          permission: input.permission,
          grantedById
        },
        create: {
          id: randomUUID(),
          formId: input.formId,
          userId: input.userId,
          permission: input.permission,
          grantedById
        },
        include: {
          user: true,
          grantedBy: true
        }
      });

      return permission;
    },

    removeFormAccess: async (
      _: any,
      { formId, userId }: { formId: string; userId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const grantedById = context.auth.user!.id;

      // Check if user has permission to manage permissions
      const accessCheck = await checkFormAccess(grantedById, formId, PermissionLevel.EDITOR);
      if (!accessCheck.hasAccess) {
        throw new GraphQLError('Access denied: Insufficient permissions');
      }

      // Prevent removing access from form owner
      if (accessCheck.form.createdById === userId) {
        throw new GraphQLError('Cannot remove access from form owner');
      }

      const result = await prisma.formPermission.deleteMany({
        where: {
          formId,
          userId
        }
      });

      return result.count > 0;
    }
  },

  Form: {
    permissions: async (parent: any) => {
      return await prisma.formPermission.findMany({
        where: { formId: parent.id },
        include: {
          user: true,
          grantedBy: true
        },
        orderBy: { grantedAt: 'desc' }
      });
    },

    userPermission: async (parent: any, _args: any, context: { auth: BetterAuthContext }) => {
      if (!context.auth?.user?.id) return null;
      
      const accessCheck = await checkFormAccess(context.auth.user.id, parent.id);
      return accessCheck.permission;
    }
  },

  FormPermission: {
    id: (parent: any) => parent.id,
    formId: (parent: any) => parent.formId,
    userId: (parent: any) => parent.userId,
    user: (parent: any) => parent.user,
    permission: (parent: any) => parent.permission,
    grantedBy: (parent: any) => parent.grantedBy,
    grantedAt: (parent: any) => parent.grantedAt.toISOString(),
    updatedAt: (parent: any) => parent.updatedAt.toISOString()
  }
};