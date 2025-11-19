import { GraphQLError } from '#graphql-errors';
import { prisma } from '../../lib/prisma.js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { s3Config } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';

export interface AdminOrganizationsArgs {
  limit?: number;
  offset?: number;
}

export interface AdminOrganizationArgs {
  id: string;
}

export interface AdminUsersArgs {
  page?: number;
  limit?: number;
  search?: string;
}

export interface AdminUserByIdArgs {
  id: string;
}

export interface AdminOrganizationByIdArgs {
  id: string;
}

// Initialize S3 client for storage stats
const s3Client = new S3Client({
  region: 'auto',
  endpoint: s3Config.endpoint,
  credentials: {
    accessKeyId: s3Config.accessKey,
    secretAccessKey: s3Config.secretKey,
  },
});

// Helper function to check if user has admin privileges
function requireAdminRole(context: any) {
  if (!context.user) {
    throw new GraphQLError('Authentication required');
  }

  const userRole = context.user.role;
  if (!userRole || (userRole !== 'admin' && userRole !== 'superAdmin')) {
    throw new GraphQLError('Admin privileges required');
  }

  return context.user;
}

// Helper function to format bytes to human readable format
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Helper function to get S3 storage statistics
async function getS3StorageStats(): Promise<{ storageUsed: string; fileCount: number }> {
  try {
    let totalSize = 0;
    let totalFiles = 0;
    let isTruncated = true;
    let continuationToken: string | undefined;

    while (isTruncated) {
      const command = new ListObjectsV2Command({
        Bucket: s3Config.publicBucketName,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);
      
      if (response.Contents) {
        totalFiles += response.Contents.length;
        totalSize += response.Contents.reduce((acc, obj) => acc + (obj.Size || 0), 0);
      }

      isTruncated = response.IsTruncated || false;
      continuationToken = response.NextContinuationToken;
    }

    return {
      storageUsed: formatBytes(totalSize),
      fileCount: totalFiles,
    };
  } catch (error) {
    logger.error('Error fetching S3 storage stats:', error);
    return {
      storageUsed: '0 B',
      fileCount: 0,
    };
  }
}

// Helper function to get PostgreSQL storage statistics
async function getMongoStorageStats(): Promise<{ mongoDbSize: string; mongoCollectionCount: number }> {
  try {
    // For PostgreSQL, we'll return approximate stats
    // In a production environment, you might want to use pg admin functions
    // For now, return basic metrics
    return {
      mongoDbSize: 'N/A (PostgreSQL)',
      mongoCollectionCount: 21, // Number of tables in schema
    };
  } catch (error) {
    logger.error('Error fetching PostgreSQL storage stats:', error);
    return {
      mongoDbSize: '0 B',
      mongoCollectionCount: 0,
    };
  }
}

export const adminResolvers = {
  Query: {
    adminOrganizations: async (_: any, args: AdminOrganizationsArgs, context: any) => {
      // Check admin privileges
      requireAdminRole(context);

      try {
        const { limit = 50, offset = 0 } = args;

        const organizations = await prisma.organization.findMany({
          skip: offset,
          take: limit,
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
        logger.error('Error fetching admin organizations:', error);
        throw new GraphQLError('Failed to fetch organizations');
      }
    },

    adminOrganization: async (_: any, args: AdminOrganizationArgs, context: any) => {
      // Check admin privileges
      requireAdminRole(context);

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
        logger.error('Error fetching admin organization:', error);
        throw new GraphQLError('Failed to fetch organization');
      }
    },

    adminStats: async (_: any, __: any, context: any) => {
      // Check admin privileges
      requireAdminRole(context);

      try {
        const [
          organizationCount,
          userCount,
          formCount,
          responseCount,
          s3Stats,
          mongoStats
        ] = await Promise.all([
          prisma.organization.count(),
          prisma.user.count(),
          prisma.form.count(),
          prisma.response.count(),
          getS3StorageStats(),
          getMongoStorageStats(),
        ]);

        return {
          organizationCount,
          userCount,
          formCount,
          responseCount,
          storageUsed: s3Stats.storageUsed,
          fileCount: s3Stats.fileCount,
          mongoDbSize: mongoStats.mongoDbSize,
          mongoCollectionCount: mongoStats.mongoCollectionCount,
        };
      } catch (error) {
        logger.error('Error fetching admin stats:', error);
        throw new GraphQLError('Failed to fetch admin statistics');
      }
    },

    adminUsers: async (_: any, args: AdminUsersArgs, context: any) => {
      // Check admin privileges
      requireAdminRole(context);

      try {
        const { page = 1, limit = 20, search } = args;
        const skip = (page - 1) * limit;

        // Build where clause for search
        const whereClause: any = {};
        if (search) {
          whereClause.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ];
        }

        const [users, totalCount] = await Promise.all([
          prisma.user.findMany({
            where: whereClause,
            skip,
            take: limit,
            include: {
              members: {
                include: {
                  organization: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          }),
          prisma.user.count({ where: whereClause }),
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        return {
          users: users.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
            image: user.image,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
            organizations: user.members.map((m: any) => ({
              organizationId: m.organization.id,
              organizationName: m.organization.name,
              organizationSlug: m.organization.slug,
              role: m.role,
              createdAt: m.createdAt.toISOString(),
            })),
          })),
          totalCount,
          currentPage: page,
          totalPages,
        };
      } catch (error) {
        logger.error('Error fetching admin users:', error);
        throw new GraphQLError('Failed to fetch users');
      }
    },

    adminUserById: async (_: any, args: AdminUserByIdArgs, context: any) => {
      // Check admin privileges
      requireAdminRole(context);

      try {
        const user = await prisma.user.findUnique({
          where: { id: args.id },
          include: {
            members: {
              include: {
                organization: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        });

        if (!user) {
          throw new GraphQLError('User not found');
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          organizations: user.members.map((m: any) => ({
            organizationId: m.organization.id,
            organizationName: m.organization.name,
            organizationSlug: m.organization.slug,
            role: m.role,
            createdAt: m.createdAt.toISOString(),
          })),
        };
      } catch (error) {
        logger.error('Error fetching admin user:', error);
        throw new GraphQLError('Failed to fetch user');
      }
    },

    adminOrganizationById: async (_: any, args: AdminOrganizationByIdArgs, context: any) => {
      // Check admin privileges
      requireAdminRole(context);

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
                    image: true,
                  },
                },
              },
            },
            forms: true,
          },
        });

        if (!organization) {
          throw new GraphQLError('Organization not found');
        }

        // Count total responses for this organization
        const totalResponses = await prisma.response.count({
          where: {
            form: {
              organizationId: organization.id,
            },
          },
        });

        return {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logo: organization.logo,
          createdAt: organization.createdAt.toISOString(),
          members: organization.members.map(m => ({
            userId: m.user.id,
            userName: m.user.name,
            userEmail: m.user.email,
            userImage: m.user.image,
            role: m.role,
            createdAt: m.createdAt.toISOString(),
          })),
          stats: {
            totalForms: organization.forms.length,
            totalResponses,
          },
        };
      } catch (error) {
        logger.error('Error fetching admin organization by id:', error);
        throw new GraphQLError('Failed to fetch organization');
      }
    },
  },
};