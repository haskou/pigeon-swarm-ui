const FAILURE_LOG = 'Direct mailbox side effect failed; legacy path kept.';

/**
 * Runs a direct-message mailbox write beside the legacy path. The mailbox
 * write is a copy, so its failure must never fail or duplicate the legacy
 * send. The effect starts synchronously. A synchronous throw or a rejection is
 * contained and logged count-only.
 */
export function runMailboxSideEffect(effect: () => unknown): void {
  try {
    Promise.resolve(effect()).catch(() => {
      // Count-only: no ids, content, or error details.
      // eslint-disable-next-line no-console
      console.debug(FAILURE_LOG);
    });
  } catch {
    // Count-only: no ids, content, or error details.
    // eslint-disable-next-line no-console
    console.debug(FAILURE_LOG);
  }
}
