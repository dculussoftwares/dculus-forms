import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { prisma } from '../../lib/prisma.js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { s3Config } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import {
  cancelChargebeeSubscription,
  reactivateChargebeeSubscription,
  setEnterpriseSubscription,
  getAdminPlanCatalog,
  createPlan,
  updatePlan,
  archivePlan,
  unarchivePlan,
  changeOrganizationPlan,
  type PlanLimitsInput,
  type PlanPriceInput,
} from '../../services/chargebeeService.js';
import { resetUsageCounters } from '../../subscriptions/usageService.js';
import { invalidateAIBudgetCache, getAITokenUsage } from '../../services/aiUsageService.js';
import { type BetterAuthContext } from '../../middleware/better-auth-middleware.js';

export interface AdminOrganizationsArgs {
  limit?: number;
  offset?: number;
  search?: string;
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

export interface AdminPlanPriceArg {
  currency: string;
  period: string;
  priceInSmallestUnit: number;
}

export interface AdminPlanLimitsArg {
  views?: number | null;
  submissions?: number | null;
  aiCredits?: number | null;
}

function validatePlanPrices(prices: AdminPlanPriceArg[]): PlanPriceInput[] {
  return prices.map((price) => {
    if (!['USD', 'INR'].includes(price.currency)) {
      throw createGraphQLError('Invalid currency', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
    }
    if (!['monthly', 'yearly'].includes(price.period)) {
      throw createGraphQLError('Invalid billing period', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
    }
    if (!Number.isInteger(price.priceInSmallestUnit) || price.priceInSmallestUnit < 0) {
      throw createGraphQLError('Price must be a non-negative integer', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
    }
    return {
      currency: price.currency as 'USD' | 'INR',
      period: price.period as 'monthly' | 'yearly',
      priceInSmallestUnit: price.priceInSmallestUnit,
    };
  });
}

function validatePlanLimits(limits: AdminPlanLimitsArg): PlanLimitsInput {
  for (const [label, value] of [
    ['views', limits.views],
    ['submissions', limits.submissions],
    ['aiCredits', limits.aiCredits],
  ] as const) {
    if (value != null && (!Number.isInteger(value) || value < 0)) {
      throw createGraphQLError(
        `${label} must be a non-negative integer or null (unlimited)`,
        GRAPHQL_ERROR_CODES.BAD_USER_INPUT
      );
    }
  }
  return {
    views: limits.views ?? null,
    submissions: limits.submissions ?? null,
    aiCredits: limits.aiCredits ?? null,
  };
}

async function getAdminPlansWithSubscriberCounts() {
  const [catalog, counts] = await Promise.all([
    getAdminPlanCatalog(),
    prisma.subscription.groupBy({ by: ['planId'], _count: { _all: true } }),
  ]);
  const countByPlan = new Map(counts.map((c) => [c.planId, c._count._all]));
  return catalog.map((plan) => ({
    ...plan,
    subscriberCount: countByPlan.get(plan.id) ?? 0,
  }));
}

// P2-06: In-memory cache for S3 storage stats (expensive operation — paginates all objects)
let statsCache: { data: { storageUsed: string; fileCount: number }; timestamp: number } | null = null;
const STATS_CACHE_TTL = 60 * 60 * 1000; // 60 minutes

/** Exposed for testing purposes only — clears the S3 stats cache. */
export function _clearStatsCacheForTests() {
  statsCache = null;
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

function requireAdminRole(context: { auth: BetterAuthContext }) {
  if (!context.auth?.user) {
    throw createGraphQLError('Authentication required', GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED);
  }
  const role = context.auth.user.role;
  if (role !== 'admin' && role !== 'superAdmin') {
    throw createGraphQLError('Admin privileges required', GRAPHQL_ERROR_CODES.NO_ACCESS);
  }
  return context.auth.user;
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
// P2-06: Results are cached for STATS_CACHE_TTL to avoid expensive paginated S3 list calls on every request
async function getS3StorageStats(): Promise<{ storageUsed: string; fileCount: number }> {
  const now = Date.now();
  if (statsCache && now - statsCache.timestamp < STATS_CACHE_TTL) {
    logger.info('Returning cached S3 storage stats');
    return statsCache.data;
  }

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

    const result = {
      storageUsed: formatBytes(totalSize),
      fileCount: totalFiles,
    };

    statsCache = { data: result, timestamp: now };
    return result;
  } catch (error) {
    logger.error('Error fetching S3 storage stats:', error);
    return {
      storageUsed: '0 B',
      fileCount: 0,
    };
  }
}


async function getPostgresStats(): Promise<{ postgresDbSize: string; postgresTableCount: number }> {
  try {
    const [sizeResult, tableResult] = await Promise.all([
      prisma.$queryRaw<[{ size: string }]>`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    ]);
    return {
      postgresDbSize: sizeResult[0]?.size ?? '0 B',
      postgresTableCount: Number(tableResult[0]?.count ?? 0),
    };
  } catch (error) {
    logger.error('Error fetching PostgreSQL stats:', error);
    return { postgresDbSize: '0 B', postgresTableCount: 0 };
  }
}

function serializeDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export const adminResolvers = {
  Query: {
    adminOrganizations: async (_: any, args: AdminOrganizationsArgs, context: { auth: BetterAuthContext }) => {
      requireAdminRole(context);

      try {
        const limit = Math.min(Math.max(1, args.limit ?? 50), 100);
        const offset = Math.max(0, args.offset ?? 0);

        const whereClause = args.search
          ? {
              OR: [
                { name: { contains: args.search, mode: 'insensitive' as const } },
                { slug: { contains: args.search, mode: 'insensitive' as const } },
              ],
            }
          : {};

        const organizations = await prisma.organization.findMany({
          skip: offset,
          take: limit,
          where: whereClause,
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
            forms: {
              select: { id: true, title: true, isPublished: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            },
            subscription: true,
            _count: { select: { members: true, forms: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        const total = await prisma.organization.count({ where: whereClause });

        return {
          organizations: organizations.map(org => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            logo: org.logo,
            createdAt: serializeDate(org.createdAt)!,
            updatedAt: serializeDate(org.updatedAt)!,
            memberCount: org._count.members,
            formCount: org._count.forms,
            members: org.members,
            forms: org.forms.map(f => ({ ...f, createdAt: serializeDate(f.createdAt)! })),
            planId: org.subscription?.planId ?? null,
            subscriptionStatus: org.subscription?.status ?? null,
            submissionsUsed: org.subscription?.submissionsUsed ?? null,
            submissionsLimit: org.subscription?.submissionsLimit ?? null,
          })),
          total,
          hasMore: offset + limit < total,
        };
      } catch (error) {
        logger.error('Error fetching admin organizations:', error);
        throw createGraphQLError('Failed to fetch organizations', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },

    adminOrganization: async (_: any, args: AdminOrganizationArgs, context: { auth: BetterAuthContext }) => {
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
          throw createGraphQLError('Organization not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
        }

        return {
          ...organization,
          createdAt: serializeDate(organization.createdAt)!,
          updatedAt: serializeDate(organization.updatedAt)!,
          memberCount: organization._count.members,
          formCount: organization._count.forms,
          forms: organization.forms.map(f => ({
            ...f,
            createdAt: serializeDate(f.createdAt)!,
          })),
        };
      } catch (error) {
        logger.error('Error fetching admin organization:', error);
        throw createGraphQLError('Failed to fetch organization', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },

    adminStats: async (_: any, __: any, context: { auth: BetterAuthContext }) => {
      // Check admin privileges
      requireAdminRole(context);

      try {
        const [
          organizationCount,
          userCount,
          formCount,
          responseCount,
          s3Stats,
          pgStats,
          freePlanCount,
          starterPlanCount,
          advancedPlanCount,
          subscriptionsWithLimits,
        ] = await Promise.all([
          prisma.organization.count(),
          prisma.user.count(),
          prisma.form.count(),
          prisma.response.count(),
          getS3StorageStats(),
          getPostgresStats(),
          prisma.subscription.count({ where: { planId: 'free' } }),
          prisma.subscription.count({ where: { planId: 'starter' } }),
          prisma.subscription.count({ where: { planId: 'advanced' } }),
          prisma.subscription.findMany({
            where: { submissionsLimit: { not: null } },
            include: { organization: { select: { id: true, name: true } } },
          }),
        ]);

        const orgsNearLimit = (subscriptionsWithLimits as any[])
          .filter(s => s.submissionsLimit && s.submissionsUsed / s.submissionsLimit >= 0.8)
          .map(s => ({
            orgId: s.organization.id,
            orgName: s.organization.name,
            submissionsUsed: s.submissionsUsed,
            submissionsLimit: s.submissionsLimit,
            usagePercent: Math.round((s.submissionsUsed / s.submissionsLimit) * 100),
          }));

        return {
          organizationCount,
          userCount,
          formCount,
          responseCount,
          storageUsed: s3Stats.storageUsed,
          fileCount: s3Stats.fileCount,
          postgresDbSize: pgStats.postgresDbSize,
          postgresTableCount: pgStats.postgresTableCount,
          freePlanCount,
          starterPlanCount,
          advancedPlanCount,
          orgsNearLimit,
        };
      } catch (error) {
        logger.error('Error fetching admin stats:', error);
        throw createGraphQLError('Failed to fetch admin statistics', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },

    adminUsers: async (_: any, args: AdminUsersArgs, context: { auth: BetterAuthContext }) => {
      // Check admin privileges
      requireAdminRole(context);

      try {
        const page = Math.max(1, args.page ?? 1);
        const limit = Math.min(Math.max(1, args.limit ?? 20), 100);
        const search = args.search;
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
        throw createGraphQLError('Failed to fetch users', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },

    adminUserById: async (_: any, args: AdminUserByIdArgs, context: { auth: BetterAuthContext }) => {
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
          throw createGraphQLError('User not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
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
        throw createGraphQLError('Failed to fetch user', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },

    adminSystemHealth: async (_: any, __: any, context: { auth: BetterAuthContext }) => {
      requireAdminRole(context);

      const checks = await Promise.allSettled([
        // Database
        (async () => {
          const start = Date.now();
          await prisma.$queryRaw`SELECT 1`;
          return { label: 'Database', status: 'ok', latencyMs: Date.now() - start, detail: null };
        })(),
        // Chargebee
        (async () => {
          const ok = !!(process.env.CHARGEBEE_API_KEY && process.env.CHARGEBEE_SITE);
          return { label: 'Chargebee', status: ok ? 'ok' : 'degraded', latencyMs: null, detail: ok ? null : 'API key or site not configured' };
        })(),
        // S3 Storage
        (async () => {
          const ok = !!(process.env.PUBLIC_S3_ACCESS_KEY && process.env.PUBLIC_S3_ENDPOINT);
          return { label: 'S3 Storage', status: ok ? 'ok' : 'degraded', latencyMs: null, detail: ok ? null : 'S3 credentials not configured' };
        })(),
        // Email
        (async () => {
          const ok = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER);
          return { label: 'Email', status: ok ? 'ok' : 'degraded', latencyMs: null, detail: ok ? null : 'SMTP not configured' };
        })(),
      ]);

      return checks.map((result, i) => {
        const labels = ['Database', 'Chargebee', 'S3 Storage', 'Email'];
        if (result.status === 'fulfilled') return result.value;
        return { label: labels[i], status: 'error', latencyMs: null, detail: String((result as PromiseRejectedResult).reason) };
      });
    },

    adminOrganizationById: async (_: any, args: AdminOrganizationByIdArgs, context: { auth: BetterAuthContext }) => {
      // Check admin privileges
      requireAdminRole(context);

      try {
        // P2-06: Use a selective `select` on forms to omit the potentially large
        // `formSchema` JSON blob. Loading `forms: true` would eagerly fetch the
        // full schema for every form in the organisation — this is wasteful for
        // the admin overview which only needs basic metadata.
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
            forms: {
              select: {
                id: true,
                title: true,
                isPublished: true,
                createdAt: true,
                updatedAt: true,
                sharingScope: true,
              },
            },
            subscription: true,
          },
        });

        if (!organization) {
          throw createGraphQLError('Organization not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
        }

        // Count total responses for this organization
        const totalResponses = await prisma.response.count({
          where: {
            form: {
              organizationId: organization.id,
            },
          },
        });

        let aiCreditsUsed = 0;
        if (organization.subscription) {
          const aiUsage = await getAITokenUsage(organization.id);
          aiCreditsUsed = aiUsage.creditsUsed;
        }

        return {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logo: organization.logo,
          createdAt: serializeDate(organization.createdAt)!,
          members: organization.members.map(m => ({
            userId: m.user.id,
            userName: m.user.name,
            userEmail: m.user.email,
            userImage: m.user.image,
            role: m.role,
            createdAt: serializeDate(m.createdAt)!,
          })),
          stats: {
            totalForms: organization.forms.length,
            totalResponses,
          },
          subscription: organization.subscription
            ? {
                planId: organization.subscription.planId,
                status: organization.subscription.status,
                viewsUsed: organization.subscription.viewsUsed,
                submissionsUsed: organization.subscription.submissionsUsed,
                aiCreditsUsed,
                viewsLimit: organization.subscription.viewsLimit,
                submissionsLimit: organization.subscription.submissionsLimit,
                aiCreditsLimit: organization.subscription.aiCreditsLimit,
                currentPeriodStart: serializeDate(organization.subscription.currentPeriodStart)!,
                currentPeriodEnd: serializeDate(organization.subscription.currentPeriodEnd)!,
                chargebeeCustomerId: organization.subscription.chargebeeCustomerId,
                chargebeeSubscriptionId: organization.subscription.chargebeeSubscriptionId,
              }
            : null,
        };
      } catch (error) {
        logger.error('Error fetching admin organization by id:', error);
        throw createGraphQLError('Failed to fetch organization', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },

    adminPlans: async (_: any, __: any, context: { auth: BetterAuthContext }) => {
      requireAdminRole(context);
      try {
        return await getAdminPlansWithSubscriberCounts();
      } catch (error) {
        logger.error('Error fetching admin plan catalog:', error);
        throw createGraphQLError('Failed to fetch plan catalog', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },
  },

  Mutation: {
    adminCreatePlan: async (
      _: any,
      args: {
        input: {
          id: string;
          name: string;
          description?: string | null;
          prices: AdminPlanPriceArg[];
          limits: AdminPlanLimitsArg;
          visibleOnPricingPage?: boolean | null;
        };
      },
      context: { auth: BetterAuthContext }
    ) => {
      const admin = requireAdminRole(context);
      const { input } = args;

      if (!input.name?.trim()) {
        throw createGraphQLError('Plan name is required', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }
      if (!input.prices?.length) {
        throw createGraphQLError('At least one price is required', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }
      const prices = validatePlanPrices(input.prices);
      const limits = validatePlanLimits(input.limits ?? {});

      try {
        await createPlan({
          id: input.id,
          name: input.name.trim(),
          description: input.description ?? undefined,
          prices,
          limits,
          visibleOnPricingPage: input.visibleOnPricingPage ?? false,
        });
      } catch (error: any) {
        throw createGraphQLError(error.message, GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      await prisma.auditLog.create({
        data: {
          action: 'plan_created',
          actorId: admin.id,
          resourceType: 'Plan',
          resourceId: input.id,
          metadata: {
            name: input.name,
            prices: prices as any,
            limits: limits as any,
            visibleOnPricingPage: input.visibleOnPricingPage ?? false,
            changedBy: admin.email,
          },
        },
      });

      logger.info(`[Admin] Plan ${input.id} created by ${admin.email}`);
      const plan = (await getAdminPlansWithSubscriberCounts()).find((p) => p.id === input.id);
      if (!plan) {
        throw createGraphQLError('Plan was created but could not be read back', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
      return plan;
    },

    adminUpdatePlan: async (
      _: any,
      args: {
        input: {
          id: string;
          name?: string | null;
          description?: string | null;
          prices?: AdminPlanPriceArg[] | null;
          limits?: AdminPlanLimitsArg | null;
          visibleOnPricingPage?: boolean | null;
        };
      },
      context: { auth: BetterAuthContext }
    ) => {
      const admin = requireAdminRole(context);
      const { input } = args;

      const prices = input.prices?.length ? validatePlanPrices(input.prices) : undefined;
      const limits = input.limits ? validatePlanLimits(input.limits) : undefined;

      let backfilledOrganizations = 0;
      try {
        const result = await updatePlan({
          id: input.id,
          name: input.name ?? undefined,
          description: input.description ?? undefined,
          prices,
          limits,
          visibleOnPricingPage: input.visibleOnPricingPage ?? undefined,
        });
        backfilledOrganizations = result.backfilledOrganizations;
      } catch (error: any) {
        throw createGraphQLError(error.message, GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      await prisma.auditLog.create({
        data: {
          action: 'plan_updated',
          actorId: admin.id,
          resourceType: 'Plan',
          resourceId: input.id,
          metadata: {
            name: input.name ?? null,
            prices: (prices ?? null) as any,
            limits: (limits ?? null) as any,
            visibleOnPricingPage: input.visibleOnPricingPage ?? null,
            backfilledOrganizations,
            changedBy: admin.email,
          },
        },
      });

      logger.info(`[Admin] Plan ${input.id} updated by ${admin.email}`);
      const plan = (await getAdminPlansWithSubscriberCounts()).find((p) => p.id === input.id);
      if (!plan) {
        throw createGraphQLError('Plan was updated but could not be read back', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
      return plan;
    },

    adminArchivePlan: async (_: any, args: { planId: string }, context: { auth: BetterAuthContext }) => {
      const admin = requireAdminRole(context);
      const { planId } = args;

      try {
        await archivePlan(planId);
      } catch (error: any) {
        throw createGraphQLError(error.message, GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      await prisma.auditLog.create({
        data: {
          action: 'plan_archived',
          actorId: admin.id,
          resourceType: 'Plan',
          resourceId: planId,
          metadata: { changedBy: admin.email },
        },
      });

      logger.info(`[Admin] Plan ${planId} archived by ${admin.email}`);
      return true;
    },

    adminUnarchivePlan: async (_: any, args: { planId: string }, context: { auth: BetterAuthContext }) => {
      const admin = requireAdminRole(context);
      const { planId } = args;

      try {
        await unarchivePlan(planId);
      } catch (error: any) {
        throw createGraphQLError(error.message, GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      await prisma.auditLog.create({
        data: {
          action: 'plan_unarchived',
          actorId: admin.id,
          resourceType: 'Plan',
          resourceId: planId,
          metadata: { changedBy: admin.email },
        },
      });

      logger.info(`[Admin] Plan ${planId} restored by ${admin.email}`);
      return true;
    },

    /**
     * Assign a catalog plan to an organization with real billing effect — the
     * org's Chargebee subscription is switched to the target plan (invoicing
     * and renewal webhooks behave like a self-serve plan change; when the
     * customer has no payment method, collection falls back to offline
     * invoices). Enterprise deals go through adminSetEnterprisePlan instead.
     */
    adminAssignPlan: async (_: any, args: { orgId: string; planId: string }, context: { auth: BetterAuthContext }) => {
      const admin = requireAdminRole(context);
      const { orgId, planId } = args;

      const subscription = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
      if (!subscription) {
        throw createGraphQLError('Subscription not found for this organization', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      const previousPlan = subscription.planId;

      try {
        await changeOrganizationPlan(orgId, planId);
      } catch (error: any) {
        throw createGraphQLError(error.message, GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      await prisma.auditLog.create({
        data: {
          action: 'plan_changed',
          actorId: admin.id,
          resourceType: 'Organization',
          resourceId: orgId,
          metadata: { from: previousPlan, to: planId, changedBy: admin.email },
        },
      });

      logger.info(`[Admin] Plan changed for org ${orgId}: ${previousPlan} -> ${planId} by ${admin.email}`);
      return true;
    },

    /**
     * Set (or update) a negotiated Enterprise deal for an organization —
     * pay-to-activate: paid deals return a Chargebee checkout URL (also emailed
     * to the org owner) and leave the org disabled (past_due) until the customer
     * pays; completing checkout saves their card and enables auto-collection for
     * all future renewals. $0 deals activate immediately.
     *
     * Views/submissions/AI-credits limits are admin-set directly on Postgres
     * (null = unlimited, 0 is a valid explicit cap) and are never re-derived
     * from a shared Chargebee catalog entitlement.
     */
    adminSetEnterprisePlan: async (
      _: any,
      args: {
        orgId: string;
        currency: string;
        period: string;
        priceInSmallestUnit: number;
        viewsLimit?: number | null;
        submissionsLimit?: number | null;
        aiCreditsLimit?: number | null;
      },
      context: { auth: BetterAuthContext }
    ) => {
      const admin = requireAdminRole(context);
      const { orgId, currency, period, priceInSmallestUnit, viewsLimit, submissionsLimit, aiCreditsLimit } = args;

      if (!['USD', 'INR'].includes(currency)) {
        throw createGraphQLError('Invalid currency', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }
      if (!['monthly', 'yearly'].includes(period)) {
        throw createGraphQLError('Invalid billing period', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }
      if (!Number.isInteger(priceInSmallestUnit) || priceInSmallestUnit < 0) {
        throw createGraphQLError('Price must be a non-negative integer', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }
      for (const [label, value] of [
        ['viewsLimit', viewsLimit],
        ['submissionsLimit', submissionsLimit],
        ['aiCreditsLimit', aiCreditsLimit],
      ] as const) {
        if (value != null && (!Number.isInteger(value) || value < 0)) {
          throw createGraphQLError(
            `${label} must be a non-negative integer or null (unlimited)`,
            GRAPHQL_ERROR_CODES.BAD_USER_INPUT
          );
        }
      }

      const subscription = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
      if (!subscription) {
        throw createGraphQLError('Subscription not found for this organization', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      const previousPlan = subscription.planId;

      const { checkoutUrl } = await setEnterpriseSubscription(orgId, {
        currency: currency as 'USD' | 'INR',
        period: period as 'monthly' | 'yearly',
        priceInSmallestUnit,
        viewsLimit: viewsLimit ?? null,
        submissionsLimit: submissionsLimit ?? null,
        aiCreditsLimit: aiCreditsLimit ?? null,
      });

      await prisma.auditLog.create({
        data: {
          action: 'enterprise_plan_set',
          actorId: admin.id,
          resourceType: 'Organization',
          resourceId: orgId,
          metadata: {
            from: previousPlan,
            to: 'enterprise',
            currency,
            period,
            priceInSmallestUnit,
            viewsLimit: viewsLimit ?? null,
            submissionsLimit: submissionsLimit ?? null,
            aiCreditsLimit: aiCreditsLimit ?? null,
            requiresPayment: priceInSmallestUnit > 0,
            changedBy: admin.email,
          },
        },
      });

      logger.info(`[Admin] Enterprise plan set for org ${orgId} by ${admin.email}`);
      return { requiresPayment: priceInSmallestUnit > 0, checkoutUrl };
    },

    adminResetUsage: async (_: any, args: { orgId: string }, context: { auth: BetterAuthContext }) => {
      const admin = requireAdminRole(context);
      const { orgId } = args;

      const subscription = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
      if (!subscription) {
        throw createGraphQLError('Subscription not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      const previousTokensUsed = await prisma.aIUsage.aggregate({
        where: { organizationId: orgId },
        _sum: { tokensUsed: true },
      });

      await Promise.all([
        resetUsageCounters(orgId, subscription.currentPeriodStart, subscription.currentPeriodEnd),
        prisma.aIUsage.updateMany({
          where: { organizationId: orgId },
          data: { tokensUsed: 0, creditsUsedMilli: 0 },
        }),
      ]);

      invalidateAIBudgetCache(orgId);

      await prisma.auditLog.create({
        data: {
          action: 'usage_reset',
          actorId: admin.id,
          resourceType: 'Organization',
          resourceId: orgId,
          metadata: {
            resetBy: admin.email,
            previousSubmissionsUsed: subscription.submissionsUsed,
            previousViewsUsed: subscription.viewsUsed,
            previousTokensUsed: previousTokensUsed._sum.tokensUsed ?? 0,
          },
        },
      });

      logger.info(`[Admin] Usage reset for org ${orgId} by ${admin.email}`);
      return true;
    },

    adminCancelSubscription: async (_: any, args: { orgId: string }, context: { auth: BetterAuthContext }) => {
      requireAdminRole(context);
      const { orgId } = args;

      const subscription = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
      if (!subscription) {
        throw createGraphQLError('Subscription not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }
      if (!subscription.chargebeeSubscriptionId) {
        throw createGraphQLError('No Chargebee subscription to cancel (free plan)', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      await cancelChargebeeSubscription(subscription.chargebeeSubscriptionId, true);
      await prisma.subscription.update({
        where: { organizationId: orgId },
        data: { status: 'cancelled' },
      });

      return true;
    },

    adminReactivateSubscription: async (_: any, args: { orgId: string }, context: { auth: BetterAuthContext }) => {
      requireAdminRole(context);
      const { orgId } = args;

      const subscription = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
      if (!subscription) {
        throw createGraphQLError('Subscription not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }
      if (!subscription.chargebeeSubscriptionId) {
        throw createGraphQLError('No Chargebee subscription to reactivate', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      await reactivateChargebeeSubscription(subscription.chargebeeSubscriptionId);
      await prisma.subscription.update({
        where: { organizationId: orgId },
        data: { status: 'active' },
      });

      return true;
    },
  },
};