export type CancelScheduledIdleWork = () => void;

const defaultIdleTimeoutMs = 800;

type BrowserIdleScheduler = typeof globalThis & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
};

export function runWhenBrowserIdle(
  callback: () => void,
  timeoutMs = defaultIdleTimeoutMs,
): CancelScheduledIdleWork {
  const scheduler = globalThis as BrowserIdleScheduler;

  if (scheduler.requestIdleCallback && scheduler.cancelIdleCallback) {
    const handle = scheduler.requestIdleCallback(callback, {
      timeout: timeoutMs,
    });

    return () => scheduler.cancelIdleCallback?.(handle);
  }

  const handle = scheduler.setTimeout(
    callback,
    typeof window === 'undefined' ? 0 : timeoutMs,
  );

  return () => scheduler.clearTimeout(handle);
}
