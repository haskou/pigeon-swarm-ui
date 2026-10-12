import { setImmediate as flushMacrotask } from 'timers/promises';

/**
 * Runs `run` and resolves with every unhandled rejection reported while it
 * ran, after one macrotask turn so Node has a chance to report them.
 */
export async function captureUnhandledRejections(
  run: () => Promise<void>,
): Promise<unknown[]> {
  const reasons: unknown[] = [];
  const onUnhandled = (reason: unknown): void => {
    reasons.push(reason);
  };

  process.on('unhandledRejection', onUnhandled);
  try {
    await run();
    await flushMacrotask();

    return reasons;
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
}
