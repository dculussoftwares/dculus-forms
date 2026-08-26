import { generateId } from '@dculus/utils';
import type { Prisma } from '#prisma-client';
import { automationRepository } from '../../repositories/index.js';
import { logger } from '../../lib/logger.js';
import type { AutomationGraph } from './types.js';

/**
 * Copying automations — between forms when a form is duplicated, or within one form when a user
 * duplicates a single automation (gap I).
 *
 * Kept free of any engine import on purpose: `formService` calls this, and the engine reaches
 * `formService` back through `plugins/core/context`, so importing the engine here would close a
 * cycle. Everything this needs is the repository.
 */

/**
 * Action-config keys that point at something outside this form and must never survive a copy.
 *
 * A Google Sheets action stores the id of the spreadsheet it auto-created on first run, so a copy
 * that kept it would silently append the new form's responses into the original form's sheet —
 * two forms writing into one document with nothing in the UI to suggest it. Tokens are dropped for
 * the same reason in reverse: a copy should re-authorise rather than inherit a connection.
 *
 * Dropping a key leaves the node incomplete, which the builder already renders as "setup required"
 * — the honest state for a copy that genuinely needs a decision before it can run.
 */
const EXTERNALLY_BOUND_CONFIG_KEYS = [
  'spreadsheetId',
  'spreadsheetUrl',
  'workbookId',
  'worksheetId',
  'accessToken',
  'refreshToken',
] as const;

function stripExternalBindings(config: Record<string, any>): Record<string, any> {
  const copy = { ...config };
  for (const key of EXTERNALLY_BOUND_CONFIG_KEYS) delete copy[key];
  return copy;
}

/**
 * Deep-copies a graph, giving every node and edge a fresh id.
 *
 * Ids only need to be unique within one graph, so reusing them would work — but a run's step rows
 * are keyed by node id, and sharing ids across two automations makes any future cross-automation
 * lookup (or a human reading two run histories side by side) quietly ambiguous. Fresh ids cost
 * nothing here.
 */
export function copyAutomationGraph(source: unknown): AutomationGraph {
  const graph = (source as AutomationGraph) ?? { nodes: [], edges: [] };
  const nodeIdMap = new Map<string, string>();

  const nodes = (graph.nodes ?? []).map((node) => {
    const newId = generateId();
    nodeIdMap.set(node.id, newId);
    const data = (node as { data?: Record<string, any> }).data;
    return {
      ...node,
      id: newId,
      ...(node.type === 'action' && data?.config
        ? { data: { ...data, config: stripExternalBindings(data.config) } }
        : {}),
    };
  }) as AutomationGraph['nodes'];

  const edges = (graph.edges ?? []).map((edge) => ({
    ...edge,
    id: generateId(),
    source: nodeIdMap.get(edge.source) ?? edge.source,
    target: nodeIdMap.get(edge.target) ?? edge.target,
  }));

  return { nodes, edges };
}

/**
 * Creates a copy of one automation on `targetFormId`.
 *
 * Always DRAFT, never active. A copy points at a different form (or is a second automation on the
 * same one), so activating it silently would double every delivery the original makes — and a
 * copy's integration bindings have just been stripped, so it is usually not runnable yet anyway.
 * Run health and the digest watermark start clean: they describe the original's history, and a
 * copy inheriting a watermark would skip responses it never processed.
 */
export async function copyAutomation(
  source: {
    id: string;
    name: string;
    organizationId: string;
    triggerType: string;
    triggerConfig: unknown;
    graph: unknown;
  },
  targetFormId: string,
  createdBy: string,
  name?: string
) {
  return automationRepository.createAutomation({
    id: generateId(),
    formId: targetFormId,
    organizationId: source.organizationId,
    name: name ?? source.name,
    status: 'DRAFT',
    triggerType: source.triggerType,
    triggerConfig: (source.triggerConfig ?? undefined) as Prisma.InputJsonValue | undefined,
    graph: copyAutomationGraph(source.graph) as unknown as Prisma.InputJsonValue,
    version: 1,
    createdBy,
  });
}

/**
 * Copies every automation from one form onto another — used when a form is duplicated (gap I).
 * Before this, duplicating a form silently dropped its automations: a customer who built a
 * six-step onboarding flow and cloned the form for next quarter lost all of it with no warning.
 *
 * Failures are logged, not thrown: losing the automations is bad, but failing the whole form
 * duplication over it is worse.
 */
export async function copyAutomationsToForm(
  sourceFormId: string,
  targetFormId: string,
  createdBy: string
): Promise<number> {
  try {
    const automations = await automationRepository.listByFormId(sourceFormId);
    if (automations.length === 0) return 0;

    for (const automation of automations) {
      await copyAutomation(automation, targetFormId, createdBy);
    }

    logger.info(
      `✅ Copied ${automations.length} automation(s) from form ${sourceFormId} to ${targetFormId} (as drafts)`
    );
    return automations.length;
  } catch (error) {
    logger.error(`❌ Failed to copy automations from form ${sourceFormId} to ${targetFormId}:`, error);
    return 0;
  }
}
