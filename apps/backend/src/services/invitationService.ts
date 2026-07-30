import { invitationRepository } from '../repositories/index.js';

/**
 * Fetch an invitation by ID with organization + inviter metadata eagerly loaded.
 * Returns null when no invitation exists for the given ID.
 */
export const getInvitationById = async (id: string) =>
  invitationRepository.findById(id);
