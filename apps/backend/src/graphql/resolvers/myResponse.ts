import type { BetterAuthContext } from '../../middleware/better-auth-middleware.js';
import { getFormById } from '../../services/formService.js';
import { editMyResponse, getMyResponse } from '../../services/myResponseService.js';
import { toRespondentForm } from '../../lib/respondentAccess.js';

export interface EditMyResponseInput {
  formId: string;
  data: unknown;
}

type ResolverContext = { auth: BetterAuthContext; req?: any };

/**
 * Respondent self-service: a signed-in respondent reads and, when the form
 * allows it, edits their own latest submission. Scoped to the session's user
 * id like `myQuizResult` and drafts, never a builder permission check.
 */
export const myResponseResolvers = {
  Form: {
    myResponse: (parent: any, _args: unknown, context: ResolverContext) =>
      getMyResponse(toRespondentForm(parent), context.auth),
  },
  Mutation: {
    editMyResponse: async (_: unknown, { input }: { input: EditMyResponseInput }, context: ResolverContext) =>
      editMyResponse({
        form: await getFormById(input.formId),
        auth: context.auth,
        data: input.data,
        ipAddress: context.req?.ip,
        userAgent: context.req?.headers?.['user-agent'],
      }),
  },
};
