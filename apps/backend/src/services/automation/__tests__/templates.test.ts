import { describe, it, expect } from 'vitest';
import { AUTOMATION_TEMPLATE_IDS, getAutomationTemplate } from '../templates.js';
import { validateAutomationGraph } from '../graphValidator.js';

/**
 * Templates are the first thing a user sees, so a structurally broken one is worse than no
 * template at all — it would fail activation with a graph error the user did not write. These
 * check every template against the real validator, allowing only the "fill in your details"
 * errors a template is *supposed* to leave behind.
 */

/** Errors a deliberately-incomplete template is allowed to produce — see templates.ts. */
const SETUP_REQUIRED_CODES = new Set(['INVALID_ACTION_CONFIG', 'INVALID_TRIGGER_CONFIG']);

describe('automation templates', () => {
  it('exposes a blank template plus at least one starter', () => {
    expect(AUTOMATION_TEMPLATE_IDS).toContain('blank');
    expect(AUTOMATION_TEMPLATE_IDS.length).toBeGreaterThan(1);
  });

  it('returns undefined for an unknown id rather than throwing', () => {
    expect(getAutomationTemplate('not-a-template')).toBeUndefined();
  });

  it.each(AUTOMATION_TEMPLATE_IDS)('%s builds a structurally valid graph', (id) => {
    const template = getAutomationTemplate(id)!;
    const result = validateAutomationGraph(template.buildGraph(), {
      pluginTypes: ['email', 'webhook', 'google-sheets', 'microsoft-sheets'],
      triggerType: template.triggerType,
    });

    // Structure — cycles, orphans, unreachable ends, bad branches — must be clean. Only the
    // "you still need to choose a recipient" class of error is acceptable.
    const structural = result.errors.filter((e) => !SETUP_REQUIRED_CODES.has(e.code));
    expect(structural).toEqual([]);
  });

  it.each(AUTOMATION_TEMPLATE_IDS)('%s generates unique node ids', (id) => {
    const graph = getAutomationTemplate(id)!.buildGraph();
    const ids = graph.nodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The digest node is schedule-only and must sit directly after the trigger — the validator
  // enforces both, and a template that got it wrong would be unactivatable.
  it('weekly-digest is a schedule automation that skips empty weeks', () => {
    const template = getAutomationTemplate('weekly-digest')!;
    expect(template.triggerType).toBe('schedule');

    const graph = template.buildGraph();
    const condition = graph.nodes.find((node) => node.type === 'condition');
    expect((condition as any).data.rules[0].fieldId).toBe('__digestCount');

    // The "no" branch must lead somewhere, or a quiet week leaves the run dangling.
    const falseEdge = graph.edges.find((edge) => edge.sourceHandle === 'false');
    expect(falseEdge).toBeDefined();
    expect(graph.nodes.find((node) => node.id === falseEdge!.target)?.type).toBe('end');
  });
});
