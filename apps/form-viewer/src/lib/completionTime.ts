export function buildCompletionTimeInput(completionTimeSeconds: number | null): { completionTimeSeconds?: number } {
  if (completionTimeSeconds !== null) {
    return { completionTimeSeconds };
  }
  return {};
}
