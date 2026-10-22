import { HttpConnectionError } from './HttpConnectionError';
import { HttpJsonError } from './HttpJsonError';
import { waitBeforeRetry } from './waitBeforeRetry';

// The node answers 503020 while its replicated state is still opening after a
// restart. That clears within seconds, so every read that can meet it shares
// one schedule, which totals 15.75s before the error is reported. Two things
// are retried on it: a 503020 failure, and a resolved value the caller marks
// as pending with isPending. The keychain reads use isPending for a 409 miss
// when the session holds a keychain pointer.
export const replicatedStateNotReadyCodes: ReadonlySet<string> = new Set([
  '503020',
]);
export const replicatedStateRetryDelaysMs: readonly number[] = [
  250, 500, 1000, 2000, 3000, 3000, 3000, 3000,
];

export type ReplicatedStateReadOptions = {
  /**
   * Called before each wait, on a 503020 answer or a pending value, so the
   * caller can show it.
   */
  onNotReady?: () => void;
  signal?: AbortSignal;
};

type RetryReplicatedStateReadOptions<T> = ReplicatedStateReadOptions & {
  /** Marks a resolved value that is still pending and worth another read. */
  isPending?: (value: T) => boolean;
  /** Marks a failure besides 503020 that is worth another read. */
  isRetriable?: (caught: unknown) => boolean;
};

export function isReplicatedStateNotReady(caught: unknown): boolean {
  return (
    caught instanceof HttpJsonError &&
    replicatedStateNotReadyCodes.has(String(caught.code))
  );
}

/**
 * True for a failure of a node that is still starting: the request never
 * reached it (an `HttpConnectionError`, such as a refused connection), or the
 * proxy in front of it answers 502, 503 or 504 without a Pigeon code. A coded
 * answer comes from the node itself and says what it means, so it is never
 * read as a node that is starting.
 */
export function isNodeStarting(caught: unknown): boolean {
  if (caught instanceof HttpConnectionError) {
    return true;
  }

  return (
    caught instanceof HttpJsonError &&
    caught.code === undefined &&
    (caught.status === 502 || caught.status === 503 || caught.status === 504)
  );
}

/**
 * Runs `read` until it settles. A 503020 failure, a failure `isRetriable`
 * marks, or a value `isPending` marks as pending, is read again on the shared
 * schedule; once the schedule is spent the last outcome is returned or thrown.
 * An abort of `signal` ends the wait before the next read with its reason.
 *
 * `read` must sign each attempt itself. The signature covers the timestamp, so
 * a retry that reuses signed headers is refused as a replayed request. Every
 * retry waits at least 250ms, so each attempt carries a new timestamp.
 */
export async function retryReplicatedStateRead<T>(
  read: () => Promise<T>,
  options: RetryReplicatedStateReadOptions<T> = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const retryDelayMs = replicatedStateRetryDelaysMs[attempt];
    let value: T;

    try {
      value = await read();
    } catch (caught: unknown) {
      const retriable =
        isReplicatedStateNotReady(caught) ||
        options.isRetriable?.(caught) === true;

      if (retryDelayMs === undefined || !retriable) {
        throw caught;
      }

      options.onNotReady?.();
      await waitBeforeRetry(retryDelayMs, options.signal);
      continue;
    }

    if (retryDelayMs === undefined || !options.isPending?.(value)) {
      return value;
    }

    options.onNotReady?.();
    await waitBeforeRetry(retryDelayMs, options.signal);
  }
}
