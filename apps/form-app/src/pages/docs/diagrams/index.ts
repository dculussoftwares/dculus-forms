import type { DocDiagram, DocPageMeta } from '../types';
import { submissionLifecycle } from './submissionLifecycle';
import { eventFanout } from './eventFanout';
import { requestAnatomy } from './requestAnatomy';

/**
 * Deliberately free of `import.meta.glob` and any other Vite-only syntax so the
 * file-reference test can import it under Jest. Markdown loading lives in
 * `../content.ts` for exactly that reason.
 */

/** Reading order for the whole doc set. Add new pages here. */
export const docPages: DocPageMeta[] = [
  {
    slug: 'submission-lifecycle',
    title: 'The Life of a Submission',
    summary:
      'Eight checks, one write, and three background jobs — what happens between Submit and the thank-you screen.',
    tier: 'The spine',
    markdownFile: '01-submission-lifecycle.md',
    order: 1,
    diagramSection: 'The flow',
  },
  {
    slug: 'event-fanout',
    title: 'One Event, Three Listeners',
    summary:
      'Why Integrations, Automations and PDF generation all fire on submit, without any of them appearing in the submission code.',
    tier: 'The spine',
    markdownFile: '02-event-fanout.md',
    order: 2,
    diagramSection: 'The flow',
  },
  {
    slug: 'request-anatomy',
    title: 'Request Anatomy',
    summary:
      'Resolver to service to repository to Postgres — and the rules about which layer may do what.',
    tier: 'The spine',
    markdownFile: '03-request-anatomy.md',
    order: 3,
    diagramSection: 'The layers',
  },
];

/** Diagrams by slug. A page without an entry here renders as Markdown only. */
export const docDiagrams: Record<string, DocDiagram> = {
  'submission-lifecycle': submissionLifecycle,
  'event-fanout': eventFanout,
  'request-anatomy': requestAnatomy,
};

export const TIER_ORDER = ['The spine', 'Feature engines', 'Cross-cutting'] as const;
