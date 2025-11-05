import type { Prisma } from '@prisma/client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

export const createFormSubmissionAnalyticsRepository = (
  context?: RepositoryContext
) => {
  const prisma = resolvePrisma(context);

  const create = <T extends Prisma.FormSubmissionAnalyticsCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormSubmissionAnalyticsCreateArgs>
  ) => prisma.formSubmissionAnalytics.create(args);

  const count = (args?: Prisma.FormSubmissionAnalyticsCountArgs) =>
    prisma.formSubmissionAnalytics.count(args);

  const groupBy = (args: Prisma.FormSubmissionAnalyticsGroupByArgs) =>
    prisma.formSubmissionAnalytics.groupBy(args as any);

  const findMany = <T extends Prisma.FormSubmissionAnalyticsFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormSubmissionAnalyticsFindManyArgs>
  ) => prisma.formSubmissionAnalytics.findMany(args);

  const createSubmissionEvent = async (
    data: Prisma.FormSubmissionAnalyticsUncheckedCreateInput
  ) =>
    prisma.formSubmissionAnalytics.create({
      data,
    });

  return {
    create,
    count,
    groupBy,
    findMany,
    createSubmissionEvent,
  };
};

export type FormSubmissionAnalyticsRepository = ReturnType<
  typeof createFormSubmissionAnalyticsRepository
>;

export const formSubmissionAnalyticsRepository =
  createFormSubmissionAnalyticsRepository();
