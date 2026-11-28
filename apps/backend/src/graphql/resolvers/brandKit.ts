import {
  BetterAuthContext,
  requireAuth,
  requireOrganizationMembership,
} from '../../middleware/better-auth-middleware.js';
import { getBrandKit, saveBrandKit, deleteBrandKit } from '../../services/brandKitService.js';

type BrandKitRecord = {
  id: string;
  organizationId: string;
  tokens: unknown;
  updatedById: string | null;
  updatedAt: Date;
};

export const brandKitResolvers = {
  Query: {
    organizationBrandKit: async (
      _: unknown,
      { organizationId }: { organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      return getBrandKit(organizationId);
    },
  },

  Mutation: {
    saveOrganizationBrandKit: async (
      _: unknown,
      { organizationId, tokens }: { organizationId: string; tokens: unknown },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const membership = await requireOrganizationMembership(context.auth, organizationId);
      return saveBrandKit(organizationId, context.auth.user!.id, membership.role, tokens);
    },

    deleteOrganizationBrandKit: async (
      _: unknown,
      { organizationId }: { organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const membership = await requireOrganizationMembership(context.auth, organizationId);
      return deleteBrandKit(organizationId, membership.role);
    },
  },

  OrganizationBrandKit: {
    updatedAt: (kit: BrandKitRecord) => kit.updatedAt.toISOString(),
  },
};
