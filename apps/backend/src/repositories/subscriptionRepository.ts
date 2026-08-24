import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

export const createSubscriptionRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  const findUnique = <T extends Prisma.SubscriptionFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.SubscriptionFindUniqueArgs>
  ) => prisma.subscription.findUnique(args);

  const findMany = <T extends Prisma.SubscriptionFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.SubscriptionFindManyArgs>
  ) => prisma.subscription.findMany(args);

  const count = <T extends Prisma.SubscriptionCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.SubscriptionCountArgs>
  ) => prisma.subscription.count(args);

  const upsert = <T extends Prisma.SubscriptionUpsertArgs>(
    args: Prisma.SelectSubset<T, Prisma.SubscriptionUpsertArgs>
  ) => prisma.subscription.upsert(args);

  const create = <T extends Prisma.SubscriptionCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.SubscriptionCreateArgs>
  ) => prisma.subscription.create(args);

  const update = <T extends Prisma.SubscriptionUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.SubscriptionUpdateArgs>
  ) => prisma.subscription.update(args);

  const createSubscription = async (
    data: Prisma.SubscriptionUncheckedCreateInput
  ) =>
    prisma.subscription.create({
      data,
    });

  const updateManyByPlan = (
    planId: string,
    data: Prisma.SubscriptionUncheckedUpdateManyInput
  ) => prisma.subscription.updateMany({ where: { planId }, data });

  const upsertForOrganization = async (
    organizationId: string,
    updateData: Prisma.SubscriptionUncheckedUpdateInput,
    createData: Prisma.SubscriptionUncheckedCreateInput
  ) =>
    prisma.subscription.upsert({
      where: { organizationId },
      update: updateData,
      create: createData,
    });

  // Safe read-only accessor — omits Chargebee credential fields.
  // Use this for usage checks and plan display; use findUnique for billing operations.
  const findByOrganizationPublic = (organizationId: string) =>
    prisma.subscription.findUnique({
      where: { organizationId },
      select: {
        id: true,
        organizationId: true,
        planId: true,
        status: true,
        viewsUsed: true,
        submissionsUsed: true,
        emailsUsed: true,
        viewsLimit: true,
        submissionsLimit: true,
        emailsLimit: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    });

  /**
   * Subscriber count per plan — feeds the admin plan catalog's
   * `subscriberCount` column.
   */
  const groupByPlan = () =>
    prisma.subscription.groupBy({ by: ['planId'], _count: { _all: true } });

  /**
   * Subscriptions with an explicit (non-unlimited) submissions cap, with the
   * owning organization's id/name eagerly loaded — used by the admin
   * dashboard's "orgs near their usage limit" widget.
   */
  const findManyWithLimits = () =>
    prisma.subscription.findMany({
      where: { submissionsLimit: { not: null } },
      include: { organization: { select: { id: true, name: true } } },
    });

  return {
    findUnique,
    findMany,
    count,
    upsert,
    create,
    update,
    updateManyByPlan,
    createSubscription,
    upsertForOrganization,
    findByOrganizationPublic,
    groupByPlan,
    findManyWithLimits,
  };
};

export type SubscriptionRepository = ReturnType<
  typeof createSubscriptionRepository
>;

export const subscriptionRepository = createSubscriptionRepository();
