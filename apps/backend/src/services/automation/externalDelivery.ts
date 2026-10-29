/**
 * Action types that send form data off-platform. Plugins that do the same (webhook, email, sheets)
 * require OWNER on the form, so an automation using them must not let an EDITOR bypass that by
 * publishing or activating it.
 */
export const OFF_PLATFORM_ACTION_TYPES = ['webhook', 'email', 'google-sheets', 'microsoft-sheets'] as const;

export function graphHasOffPlatformDelivery(graph: unknown): boolean {
  const nodes = (graph as { nodes?: unknown })?.nodes;
  if (!Array.isArray(nodes)) return false;
  return nodes.some(
    (node) =>
      node?.type === 'action' &&
      (OFF_PLATFORM_ACTION_TYPES as readonly string[]).includes(node?.data?.actionType)
  );
}
