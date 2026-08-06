import type { DocDiagram } from '../types';

/**
 * Companion diagram for `docs/architecture/01-submission-lifecycle.md`.
 *
 * The shape carries the argument: a column of gates, one write, then a fan of
 * effects hanging off that write. Anything below the write node is in "already
 * succeeded" territory and cannot fail the respondent's request.
 *
 * Gates that are a single line of validation are grouped rather than given a box
 * each — the prose walks all of them individually, and a fit-to-view graph deep
 * enough to hold ten sequential boxes shrinks its own labels past readable.
 */
export const submissionLifecycle: DocDiagram = {
  direction: 'TB',
  nodes: [
    {
      id: 'respondent',
      data: {
        label: 'Respondent submits',
        kind: 'entry',
        file: 'apps/backend/src/graphql/resolvers/responses.ts',
        line: 145,
        does: 'The public submitResponse mutation receives the answers.',
        note: 'Public — callable directly with any GraphQL client, not just from form-viewer. Every check below exists because of that.',
      },
    },
    {
      id: 'eligibility',
      data: {
        label: 'Eligibility checks',
        kind: 'gate',
        file: 'apps/backend/src/graphql/resolvers/responses.ts',
        line: 156,
        does: 'Verifies any isPreview claim against real EDITOR permission, then requires the form to be published.',
        note: 'isPreview skips the publish check and access control, so it is verified first — otherwise anyone could set it and submit to a restricted draft.',
      },
    },
    {
      id: 'access',
      data: {
        label: 'Access control',
        kind: 'gate',
        file: 'apps/backend/src/lib/accessControlEnforcement.ts',
        does: 'Enforces the sign-in requirement and the email-domain allowlist.',
        note: 'Shared with the viewer gate, so viewing and submitting are gated identically. This call is the boundary that actually matters.',
        shared: 'Shared with form-viewer gate',
      },
    },
    {
      id: 'quota',
      data: {
        label: 'Subscription quota',
        kind: 'gate',
        file: 'apps/backend/src/subscriptions/usageService.ts',
        does: 'Rejects the submission if the organization is over its plan submission limit.',
        note: 'A hard stop, not a warning. The 80% warning event is emitted elsewhere.',
      },
    },
    {
      id: 'sanitise',
      data: {
        label: 'Validate & strip payload',
        kind: 'gate',
        file: 'apps/backend/src/lib/conditionalStrip.ts',
        does: 'Caps the payload at 500 fields and 10,000 characters per value, then deletes answers for fields the conditional logic hides.',
        note: 'Stripping is evaluated against the live Hocuspocus schema, falling back to the DB column — so a rule edited seconds ago is already in force.',
      },
    },
    {
      id: 'limits',
      data: {
        label: 'Submission limits',
        kind: 'gate',
        file: 'apps/backend/src/graphql/resolvers/responses.ts',
        line: 240,
        does: 'Applies the per-form max-responses cap and the open/close time window.',
        note: 'With a max-responses cap the count and insert happen together in one Serializable transaction, so two concurrent requests cannot both pass.',
      },
    },
    {
      id: 'persist',
      data: {
        label: 'Write the Response row',
        kind: 'write',
        file: 'apps/backend/src/services/responseService.ts',
        does: 'Persists the response. The point of no return.',
        note: 'Everything below has already succeeded from the respondent point of view. Nothing below may throw.',
        shared: 'Read by exports, analytics, PDFs',
      },
    },
    {
      id: 'record',
      data: {
        label: 'Tag & record analytics',
        kind: 'effect',
        file: 'apps/backend/src/services/analyticsService.ts',
        does: 'Tags builder previews with __preview__, and records device, browser, OS, geolocation and completion time.',
        note: 'Preview submissions are real rows, just tagged — anything that counts responses has to decide whether to include them.',
      },
    },
    {
      id: 'thankyou',
      data: {
        label: 'Build thank-you message',
        kind: 'effect',
        file: 'apps/backend/src/graphql/resolvers/responses.ts',
        line: 350,
        does: 'Renders layout.thankYouContent, substituting the respondent own answers into any field mentions.',
        note: 'Reads the schema from Hocuspocus first — the Form.formSchema column is only a periodic snapshot.',
      },
    },
    {
      id: 'emitPlugin',
      data: {
        label: 'Emit form.submitted',
        kind: 'effect',
        file: 'apps/backend/src/plugins/core/events.ts',
        line: 28,
        does: 'Fans out to plugins, automations and PDF generators.',
        note: 'User answers are spread first, then responseId / submittedAt / isPreview written over the top, so a form field cannot spoof them.',
        shared: 'Three listeners — see the fan-out page',
      },
    },
    {
      id: 'emitUsage',
      data: {
        label: 'Emit usage event',
        kind: 'effect',
        file: 'apps/backend/src/subscriptions/events.ts',
        line: 134,
        does: 'Increments the organization billing counters.',
        note: 'Also called emitFormSubmitted, and unrelated to the one beside it. Imported here under an alias.',
      },
    },
    {
      id: 'copy',
      data: {
        label: 'Email response copy',
        kind: 'effect',
        file: 'apps/backend/src/services/responseCopyService.ts',
        does: 'Sends the respondent a copy of their answers, if the form owner enabled it and the respondent consented.',
        note: 'Not awaited — email and PDF work must never sit on the respondent critical path. Skipped for previews.',
      },
    },
  ],
  edges: [
    { source: 'respondent', target: 'eligibility' },
    { source: 'eligibility', target: 'access' },
    { source: 'access', target: 'quota' },
    { source: 'quota', target: 'sanitise' },
    { source: 'sanitise', target: 'limits' },
    { source: 'limits', target: 'persist' },
    { source: 'persist', target: 'record', async: true },
    { source: 'persist', target: 'thankyou', async: true },
    { source: 'persist', target: 'emitPlugin', async: true },
    { source: 'persist', target: 'emitUsage', async: true },
    { source: 'persist', target: 'copy', async: true },
  ],
};
