import type { Prisma } from '@prisma/client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

export const createSubscriptionRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  const findUnique = <T extends Prisma.SubscriptionFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.SubscriptionFindUniqueArgs>
  ) => prisma.subscription.findUnique(args);

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

  return {
    findUnique,
    upsert,
    create,
    update,
    createSubscription,
    upsertForOrganization,
  };
};

export type SubscriptionRepository = ReturnType<
  typeof createSubscriptionRepository
>;

export const subscriptionRepository = createSubscriptionRepository();
