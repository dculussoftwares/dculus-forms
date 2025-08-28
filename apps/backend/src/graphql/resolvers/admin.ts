import { GraphQLError } from 'graphql';
import { prisma } from '../../lib/prisma.js';

export interface AdminOrganizationsArgs {
  limit?: number;
  offset?: number;
}

export interface AdminOrganizationArgs {
  id: string;
}

export const adminResolvers = {
  Query: {
    adminOrganizations: async (_: any, args: AdminOrganizationsArgs, context: any) => {
      // Check if user is authenticated and has admin role
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // For now, we'll check if user exists - later we'll add proper role checking
      // TODO: Add proper super admin role checking once better-auth admin plugin is implemented

      try {
        const { limit = 50, offset = 0 } = args;

        const organizations = await prisma.organization.findMany({
          skip: offset,
          take: limit,
          include: {
            _count: {
              select: {
                members: true,
                forms: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const total = await prisma.organization.count();

        return {
          organizations: organizations.map(org => ({
            ...org,
            memberCount: org._count.members,
            formCount: org._count.forms,
          })),
          total,
          hasMore: offset + limit < total,
        };
      } catch (error) {
        console.error('Error fetching admin organizations:', error);
        throw new GraphQLError('Failed to fetch organizations');
      }
    },

    adminOrganization: async (_: any, args: AdminOrganizationArgs, context: any) => {
      // Check if user is authenticated and has admin role
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // TODO: Add proper super admin role checking

      try {
        const organization = await prisma.organization.findUnique({
          where: { id: args.id },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            forms: {
              select: {
                id: true,
                title: true,
                isPublished: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
            _count: {
              select: {
                members: true,
                forms: true,
              },
            },
          },
        });

        if (!organization) {
          throw new GraphQLError('Organization not found');
        }

        return {
          ...organization,
          memberCount: organization._count.members,
          formCount: organization._count.forms,
        };
      } catch (error) {
        console.error('Error fetching admin organization:', error);
        throw new GraphQLError('Failed to fetch organization');
      }
    },

    adminStats: async (_: any, __: any, context: any) => {
      // Check if user is authenticated and has admin role
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const [organizationCount, userCount, formCount, responseCount] = await Promise.all([
          prisma.organization.count(),
          prisma.user.count(),
          prisma.form.count(),
          prisma.response.count(),
        ]);

        return {
          organizationCount,
          userCount,
          formCount,
          responseCount,
        };
      } catch (error) {
        console.error('Error fetching admin stats:', error);
        throw new GraphQLError('Failed to fetch admin statistics');
      }
    },
  },
};