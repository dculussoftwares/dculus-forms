import { createRepository, type RepositoryContext } from './baseRepository.js';

export const createSubscriptionRepository = (context?: RepositoryContext) =>
  createRepository((client) => client.subscription, context);

export type SubscriptionRepository = ReturnType<
  typeof createSubscriptionRepository
>;

export const subscriptionRepository = createSubscriptionRepository();

