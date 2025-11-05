import { createRepository, type RepositoryContext } from './baseRepository.js';

export const createFormViewAnalyticsRepository = (
  context?: RepositoryContext
) => createRepository((client) => client.formViewAnalytics, context);

export type FormViewAnalyticsRepository = ReturnType<
  typeof createFormViewAnalyticsRepository
>;

export const formViewAnalyticsRepository =
  createFormViewAnalyticsRepository();

