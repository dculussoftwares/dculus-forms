import type { Subscription, Organization, Member, User } from '#prisma-client';
import { subscriptionRepository } from '../repositories/subscriptionRepository.js';
import { organizationRepository } from '../repositories/organizationRepository.js';
import { memberRepository } from '../repositories/memberRepository.js';

/**
 * Subscription Service
 * Thin service layer over subscriptionRepository/organizationRepository/memberRepository
 * for the `subscriptions.ts` GraphQL resolvers. Chargebee orchestration itself
 * lives in chargebeeService.ts — this service only covers the plain data
 * access those resolvers need.
 */

export const getSubscriptionByOrganization = async (
  organizationId: string
): Promise<Subscription | null> =>
  subscriptionRepository.findUnique({ where: { organizationId } });

export const getOrganizationById = async (
  organizationId: string
): Promise<Organization | null> => organizationRepository.findById(organizationId);

export const getOrganizationOwnerMember = async (
  organizationId: string
): Promise<(Member & { user: User }) | null> =>
  memberRepository.findOwnerByOrganization(organizationId);
