import type { Prisma } from '@prisma/client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

export const createFormViewAnalyticsRepository = (
  context?: RepositoryContext
) => {
  const prisma = resolvePrisma(context);

  const create = <T extends Prisma.FormViewAnalyticsCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormViewAnalyticsCreateArgs>
  ) => prisma.formViewAnalytics.create(args);

  const updateMany = <T extends Prisma.FormViewAnalyticsUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormViewAnalyticsUpdateManyArgs>
  ) => prisma.formViewAnalytics.updateMany(args);

  const count = (args?: Prisma.FormViewAnalyticsCountArgs) =>
    prisma.formViewAnalytics.count(args);

  const groupBy = (args: Prisma.FormViewAnalyticsGroupByArgs) =>
    prisma.formViewAnalytics.groupBy(args as any);

  const findMany = <T extends Prisma.FormViewAnalyticsFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormViewAnalyticsFindManyArgs>
  ) => prisma.formViewAnalytics.findMany(args);

  const createViewEvent = async (
    data: Prisma.FormViewAnalyticsUncheckedCreateInput
  ) =>
    prisma.formViewAnalytics.create({
      data,
    });

  const updateSessionMetrics = async (
    where: Prisma.FormViewAnalyticsWhereInput,
    data: Prisma.FormViewAnalyticsUpdateManyMutationInput
  ) =>
    prisma.formViewAnalytics.updateMany({
      where,
      data,
    });

  return {
    create,
    updateMany,
    count,
    groupBy,
    findMany,
    createViewEvent,
    updateSessionMetrics,
  };
};

export type FormViewAnalyticsRepository = ReturnType<
  typeof createFormViewAnalyticsRepository
>;

export const formViewAnalyticsRepository =
  createFormViewAnalyticsRepository();
