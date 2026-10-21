import { isReplicatedStateNotReady } from '../../../../shared/infrastructure/http/retryReplicatedStateRead';
import { waitBeforeRetry } from '../../../../shared/infrastructure/http/waitBeforeRetry';
import { CommunityListNotSettledError } from './CommunityListNotSettledError';

// A node that was restarted can answer 503020, or an empty list, until its
// replicated state has opened; that took over a minute on a loaded host. The
// first waits are above the 1.5s startup read cache, so each read is fresh.
const settleDelaysMs = [2000, 3000, 5000, 5000, 5000, 10000, 10000, 10000];
// Wall time after which the loop gives up, whatever the delays and the 503020
// retries inside each read add up to. The last read may still run up to the
// shared 503020 budget past it.
const settleBudgetMs = 50_000;

function nextDelayMs(
  delaysMs: number[],
  attempt: number,
  deadline: number,
): number | undefined {
  const delayMs = delaysMs[attempt];

  return delayMs !== undefined && Date.now() + delayMs <= deadline
    ? delayMs
    : undefined;
}

function isSettled<T>(
  outcome: ReadOutcome<T>,
  hadCommunities: boolean,
): boolean {
  return (
    outcome.communities !== undefined &&
    (outcome.communities.length > 0 || !hadCommunities)
  );
}

async function abortable<T>(
  pending: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();

  return await new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason);

    signal.addEventListener('abort', onAbort, { once: true });
    pending.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

type ReadOutcome<T> = { communities?: T[]; notReady?: unknown };

async function readOnce<T>(
  read: (signal: AbortSignal) => Promise<T[]>,
  signal: AbortSignal,
): Promise<ReadOutcome<T>> {
  try {
    return { communities: await abortable(read(signal), signal) };
  } catch (caught: unknown) {
    if (!isReplicatedStateNotReady(caught)) throw caught;

    return { notReady: caught };
  }
}

type ReadCommunitiesUntilSettledOptions<T> = {
  budgetMs?: number;
  delaysMs?: number[];
  /** True when this device already listed a community for the identity. */
  hadCommunities: boolean;
  /** Called before each wait, so the caller can keep a loading state. */
  onWaiting?: () => void;
  read: (signal: AbortSignal) => Promise<T[]>;
  signal?: AbortSignal;
};

/**
 * Reads the community list until the node has settled it. A 503020 answer is
 * read again. An empty list is final for a user this device never saw with a
 * community; for one it did, it may be the node's state still opening, so it is
 * read again. When the delays are spent, the 503020 failure or a
 * {@link CommunityListNotSettledError} is thrown: an empty list is never
 * reported for a device that had communities.
 */
export async function readCommunitiesUntilSettled<T>({
  budgetMs = settleBudgetMs,
  delaysMs = settleDelaysMs,
  hadCommunities,
  onWaiting,
  read,
  signal,
}: ReadCommunitiesUntilSettledOptions<T>): Promise<T[]> {
  const abort = signal ?? new AbortController().signal;
  const deadline = Date.now() + budgetMs;

  for (let attempt = 0; ; attempt++) {
    const delayMs = nextDelayMs(delaysMs, attempt, deadline);
    const outcome = await readOnce(read, abort);

    if (outcome.communities && isSettled(outcome, hadCommunities)) {
      return outcome.communities;
    }

    if (delayMs === undefined) {
      throw outcome.notReady ?? new CommunityListNotSettledError();
    }

    onWaiting?.();
    await waitBeforeRetry(delayMs, abort);
  }
}
