type PollOptions = {
  timeout?: number;
  interval?: number;
  message?: string;
};

/**
 * Polls the provided async function until it returns a truthy value or the timeout elapses.
 */
export async function expectPoll<T>(
  fn: () => Promise<T>,
  options: PollOptions = {}
): Promise<T> {
  const timeout = options.timeout ?? 5000;
  const interval = options.interval ?? 250;
  const start = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await fn();
    if (result) return result;

    if (Date.now() - start > timeout) {
      throw new Error(options.message ?? 'Polling timed out');
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
