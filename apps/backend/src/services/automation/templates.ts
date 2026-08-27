import { generateId } from '@dculus/utils';
import type { AutomationGraph } from './types.js';

/**
 * Starter graphs for the create dialog (gap I).
 *
 * The dialog used to hand over a name box, a trigger dropdown, and an empty canvas — the
 * highest-friction possible start, and the reason most automations never got past DRAFT. Each
 * template lays out a shape that is recognisably the thing the user came to build, leaving only
 * the parts that genuinely need a decision: who to email, which webhook URL, what schedule.
 *
 * Templates deliberately ship *incomplete*. Copy and structure are filled in; recipients, URLs and
 * cron expressions are not, so the builder's existing "setup required" badge and the
 * activation-time validator both point straight at what is missing. A template that pre-filled a
 * plausible-looking recipient would be worse than an empty one.
 */

export interface AutomationTemplate {
  id: string;
  /** Fixed by the template — a follow-up email only makes sense on a submission, a digest on a schedule. */
  triggerType: string;
  buildGraph: () => AutomationGraph;
}

/** Chains nodes in a straight line, wiring each to the next. Every template here is linear bar one. */
function linearGraph(nodes: Array<Omit<AutomationGraph['nodes'][number], 'id'>>): AutomationGraph {
  const withIds = nodes.map((node) => ({ ...node, id: generateId() })) as AutomationGraph['nodes'];
  const edges = withIds.slice(0, -1).map((node, i) => ({
    id: generateId(),
    source: node.id,
    target: withIds[i + 1].id,
  }));
  return { nodes: withIds, edges };
}

const TEMPLATES: AutomationTemplate[] = [
  {
    id: 'blank',
    triggerType: 'form.submitted',
    buildGraph: () =>
      linearGraph([
        { type: 'trigger', data: { triggerType: 'form.submitted' } },
        { type: 'end' } as any,
      ]),
  },
  {
    id: 'confirmation-email',
    triggerType: 'form.submitted',
    buildGraph: () =>
      linearGraph([
        { type: 'trigger', data: { triggerType: 'form.submitted' } },
        {
          type: 'action',
          data: {
            actionType: 'email',
            name: 'Send confirmation',
            config: {
              type: 'email',
              subject: 'Thanks for your submission',
              message:
                '<p>Thanks for getting in touch — we have received your submission and will be in contact shortly.</p>',
            },
          },
        },
        { type: 'end' } as any,
      ]),
  },
  {
    id: 'follow-up-email',
    triggerType: 'form.submitted',
    buildGraph: () =>
      linearGraph([
        { type: 'trigger', data: { triggerType: 'form.submitted' } },
        { type: 'delay', data: { amount: 3, unit: 'days' } },
        {
          type: 'action',
          data: {
            actionType: 'email',
            name: 'Send follow-up',
            config: {
              type: 'email',
              subject: 'Following up on your submission',
              message: '<p>Just checking in — is there anything else we can help with?</p>',
            },
          },
        },
        { type: 'end' } as any,
      ]),
  },
  {
    id: 'notify-webhook',
    triggerType: 'form.submitted',
    buildGraph: () =>
      linearGraph([
        { type: 'trigger', data: { triggerType: 'form.submitted' } },
        {
          type: 'action',
          data: { actionType: 'webhook', name: 'Post to webhook', config: { type: 'webhook' } },
        },
        { type: 'end' } as any,
      ]),
  },
  {
    id: 'weekly-digest',
    triggerType: 'schedule',
    buildGraph: () => {
      // The only non-linear template: the condition's "no" branch goes straight to the same End
      // node, so a quiet week sends nothing instead of an empty digest. Without this the schedule
      // mails an empty summary every week, which is the first thing users complain about.
      const trigger = { id: generateId(), type: 'trigger' as const, data: { triggerType: 'schedule' } };
      const digest = { id: generateId(), type: 'digest' as const, data: {} };
      const condition = {
        id: generateId(),
        type: 'condition' as const,
        data: {
          rules: [{ fieldId: '__digestCount', operator: 'GREATER_THAN', value: '0' }],
          combinator: 'AND' as const,
        },
      };
      const action = {
        id: generateId(),
        type: 'action' as const,
        data: {
          actionType: 'email',
          name: 'Send digest',
          config: {
            type: 'email',
            subject: 'Your form summary',
            message: '<p>You have {{__digestCount}} new responses since the last summary.</p>',
            includeDigestTable: true,
          },
        },
      };
      const end = { id: generateId(), type: 'end' as const };

      return {
        nodes: [trigger, digest, condition, action, end] as unknown as AutomationGraph['nodes'],
        edges: [
          { id: generateId(), source: trigger.id, target: digest.id },
          { id: generateId(), source: digest.id, target: condition.id },
          { id: generateId(), source: condition.id, target: action.id, sourceHandle: 'true' as const },
          { id: generateId(), source: condition.id, target: end.id, sourceHandle: 'false' as const },
          { id: generateId(), source: action.id, target: end.id },
        ],
      };
    },
  },
];

const TEMPLATES_BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]));

export const AUTOMATION_TEMPLATE_IDS = TEMPLATES.map((template) => template.id);

export function getAutomationTemplate(id: string): AutomationTemplate | undefined {
  return TEMPLATES_BY_ID.get(id);
}
