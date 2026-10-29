/**
 * Hard ceilings on how much an automation (and the set of automations) can hold. Every limit is
 * enforced server side; they bound the work a single form can queue, and the validation, storage
 * and run-snapshot cost of a hostile or runaway graph.
 */
export const MAX_AUTOMATION_NAME_LENGTH = 200;
export const MAX_GRAPH_NODES = 100;
export const MAX_GRAPH_EDGES = 200;
/** Serialized size of a saved graph + trigger config. */
export const MAX_AUTOMATION_BYTES = 512 * 1024;
export const MAX_AUTOMATIONS_PER_FORM = 50;
export const MAX_AUTOMATIONS_PER_ORGANIZATION = 500;

/** Counts only when both lists exist, so it is safe to call on an unvalidated JSON graph. */
export function describeGraphSizeViolation(graph: unknown): string | null {
  const { nodes, edges } = (graph ?? {}) as { nodes?: unknown; edges?: unknown };
  if (Array.isArray(nodes) && nodes.length > MAX_GRAPH_NODES) {
    return `An automation can have at most ${MAX_GRAPH_NODES} steps — remove some steps to continue.`;
  }
  if (Array.isArray(edges) && edges.length > MAX_GRAPH_EDGES) {
    return `An automation can have at most ${MAX_GRAPH_EDGES} connections between steps — remove some to continue.`;
  }
  return null;
}
