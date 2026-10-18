export function waitBeforeRetry(
  delayMs: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);

      return;
    }

    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal?.reason);
      },
      { once: true },
    );
  });
}
