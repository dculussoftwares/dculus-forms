import { createRepository, type RepositoryContext } from './baseRepository.js';

export const createFormSubmissionAnalyticsRepository = (
  context?: RepositoryContext
) => createRepository((client) => client.formSubmissionAnalytics, context);

export type FormSubmissionAnalyticsRepository = ReturnType<
  typeof createFormSubmissionAnalyticsRepository
>;

export const formSubmissionAnalyticsRepository =
  createFormSubmissionAnalyticsRepository();

