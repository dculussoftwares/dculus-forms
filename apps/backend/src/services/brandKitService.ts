import type { Prisma } from '#prisma-client';
import { sanitizeDesignTokens } from '@dculus/types';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { createGraphQLError } from '#graphql-errors';
import { brandKitRepository } from '../repositories/index.js';

const assertOwner = (role: string | null | undefined): void => {
  if (role !== 'owner') {
    throw createGraphQLError(
      'Access denied: only the organization owner can manage the brand kit',
      GRAPHQL_ERROR_CODES.NO_ACCESS
    );
  }
};

export const getBrandKit = (organizationId: string) =>
  brandKitRepository.findByOrganization(organizationId);

/** `memberRole` is the caller's Member.role in the organization. */
export const saveBrandKit = async (
  organizationId: string,
  userId: string,
  memberRole: string | null | undefined,
  tokens: unknown
) => {
  assertOwner(memberRole);
  const sanitized = sanitizeDesignTokens(tokens);
  if (!sanitized) {
    throw createGraphQLError(
      'Brand kit tokens are empty or invalid',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }
  return brandKitRepository.upsertForOrganization(
    organizationId,
    sanitized as unknown as Prisma.InputJsonValue,
    userId
  );
};

export const deleteBrandKit = async (
  organizationId: string,
  memberRole: string | null | undefined
): Promise<boolean> => {
  assertOwner(memberRole);
  await brandKitRepository.deleteByOrganization(organizationId);
  return true;
};
