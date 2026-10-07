import type { FormSettings } from '@dculus/types';
import type { BetterAuthContext } from '../../middleware/better-auth-middleware.js';
import { getFormById } from '../../services/formService.js';
import {
  canUseDrafts,
  discardResponseDraft,
  getResponseDraft,
  requireDraftAccess,
  saveResponseDraft,
} from '../../services/responseDraftService.js';

export interface SaveResponseDraftInput {
  formId: string;
  data: unknown;
  currentPageId?: string | null;
  baseVersion?: number | null;
}

type ResolverContext = { auth: BetterAuthContext };

const parseSettings = (settings: unknown): FormSettings | null => {
  if (!settings) return null;
  return (typeof settings === 'string' ? JSON.parse(settings) : settings) as FormSettings;
};

/**
 * Save-and-resume for signed-in respondents. Every operation is scoped to
 * the caller's own draft (keyed on their session's user id, never on
 * anything the client sends) — the same "is this yours" model as
 * `myQuizResult`, not a builder permission check.
 */
export const responseDraftsResolvers = {
  Form: {
    myDraft: async (parent: any, _args: unknown, context: ResolverContext) => {
      const form = { id: parent.id, isPublished: parent.isPublished, settings: parseSettings(parent.settings) };
      if (!canUseDrafts(form, context.auth)) return null;
      return getResponseDraft(form.id, context.auth.user!.id);
    },
  },
  Mutation: {
    saveResponseDraft: async (_: unknown, { input }: { input: SaveResponseDraftInput }, context: ResolverContext) => {
      const form = await getFormById(input.formId);
      const userId = requireDraftAccess(form, context.auth);
      return saveResponseDraft({
        formId: input.formId,
        userId,
        data: input.data,
        currentPageId: input.currentPageId,
        baseVersion: input.baseVersion,
      });
    },
    discardResponseDraft: async (_: unknown, { formId }: { formId: string }, context: ResolverContext) => {
      const form = await getFormById(formId);
      const userId = requireDraftAccess(form, context.auth);
      return discardResponseDraft(formId, userId);
    },
  },
};
