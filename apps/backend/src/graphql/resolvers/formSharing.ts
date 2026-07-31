import { BetterAuthContext, requireAuth, requireOrganizationMembership } from '../../middleware/better-auth-middleware.js';
import * as formSharingService from '../../services/formSharingService.js';
import { checkFormAccess } from '../../services/formSharingService.js';
import type { Permission, Scope } from '../../services/formSharingService.js';

// Re-exported for backward compatibility — other resolvers/services import these
// directly from this file (e.g. formService.ts's checkFormAccess-based permission
// checks). The implementations now live in formSharingService.ts.
export {
  PermissionLevel,
  SharingScope,
  PERMISSION_HIERARCHY,
  checkFormAccess,
} from '../../services/formSharingService.js';
export type { Permission, Scope } from '../../services/formSharingService.js';

export const formSharingResolvers = {
  Query: {
    formPermissions: async (_: any, { formId }: { formId: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      return formSharingService.getFormPermissions(context.auth.user!.id, formId);
    },


    forms: async (
      _: any,
      {
        organizationId,
        category,
        page = 1,
        limit = 10,
        filters
      }: {
        organizationId: string;
        category: string;
        page?: number;
        limit?: number;
        filters?: {
          search?: string;
        };
      },
      context: { auth: BetterAuthContext }
    ) => {
      // 🔒 SECURITY: Verify user is a member of the target organization
      await requireOrganizationMembership(context.auth, organizationId);

      return formSharingService.listForms({
        organizationId,
        category,
        userId: context.auth.user!.id,
        page,
        limit,
        filters,
      });
    },

    organizationMembers: async (_: any, { organizationId }: { organizationId: string }, context: { auth: BetterAuthContext }) => {
      // 🔒 SECURITY: Use centralized middleware to verify organization membership
      await requireOrganizationMembership(context.auth, organizationId);

      // User is verified member - return organization members
      return formSharingService.listOrganizationMembersForSharing(organizationId);
    }
  },

  Mutation: {
    shareForm: async (
      _: any,
      { input }: { input: { formId: string; sharingScope: Scope; defaultPermission?: Permission; userPermissions?: Array<{ userId: string; permission: Permission }> } },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      return formSharingService.shareForm(context.auth.user!.id, input);
    },

    updateFormPermission: async (
      _: any,
      { input }: { input: { formId: string; userId: string; permission: Permission } },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      return formSharingService.updateFormPermission(context.auth.user!.id, input);
    },

    removeFormAccess: async (
      _: any,
      { formId, userId }: { formId: string; userId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      return formSharingService.removeFormAccess(context.auth.user!.id, formId, userId);
    }
  },

  Form: {
    permissions: async (parent: any) => {
      return formSharingService.listFormPermissions(parent.id);
    },

    userPermission: async (parent: any, _args: any, context: { auth: BetterAuthContext }) => {
      if (!context.auth?.user?.id) return null;

      const accessCheck = await checkFormAccess(context.auth.user.id, parent.id);
      return accessCheck.permission;
    },

    category: (parent: any, _args: any, context: { auth: BetterAuthContext }) => {
      const userId = context.auth?.user?.id;
      if (!userId || !parent.createdById) return null;

      return parent.createdById === userId ? 'OWNER' : 'SHARED';
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
