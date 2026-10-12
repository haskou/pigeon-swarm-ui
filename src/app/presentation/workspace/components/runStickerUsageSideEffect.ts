/**
 * Runs a sticker usage write after a send has been delivered. The write is
 * local bookkeeping, so its failure must never mark the delivered send failed,
 * skip the inbox copy, or leave a rejection unhandled. The effect starts
 * synchronously. A synchronous throw or a rejection is contained and logged
 * count-only.
 */
export function runStickerUsageSideEffect(effect: () => unknown): void {
  const logFailure = (): void => {
    // Count-only: no ids, content, or error details.
    // eslint-disable-next-line no-console
    console.debug('Sticker usage side effect failed; delivered send kept.');
  };

  try {
    Promise.resolve(effect()).catch(logFailure);
  } catch {
    logFailure();
  }
}
