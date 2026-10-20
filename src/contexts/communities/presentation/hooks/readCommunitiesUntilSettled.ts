import { isReplicatedStateNotReady } from '../../../../shared/infrastructure/http/retryReplicatedStateRead';
import { waitBeforeRetry } from '../../../../shared/infrastructure/http/waitBeforeRetry';
import { CommunityListNotSettledError } from './CommunityListNotSettledError';

// A node that was restarted can answer 503020, or an empty list, until its
// replicated state has opened; that took over a minute on a loaded host. The
// first waits are above the 1.5s startup read cache, so each read is fresh.
const settleDelaysMs = [2000, 3000, 5000, 5000, 5000, 10000, 10000, 10000];

type ReadCommunitiesUntilSettledOptions<T> = {
  delaysMs?: number[];
  /** True when this device already listed a community for the identity. */
  hadCommunities: boolean;
  /** Called before each wait, so the caller can keep a loading state. */
  onWaiting?: () => void;
  read: () => Promise<T[]>;
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
  delaysMs = settleDelaysMs,
  hadCommunities,
  onWaiting,
  read,
  signal,
}: ReadCommunitiesUntilSettledOptions<T>): Promise<T[]> {
  for (let attempt = 0; ; attempt++) {
    const delayMs = delaysMs[attempt];
    let communities: T[];

    try {
      communities = await read();
    } catch (caught: unknown) {
      if (delayMs === undefined || !isReplicatedStateNotReady(caught)) {
        throw caught;
      }

      onWaiting?.();
      await waitBeforeRetry(delayMs, signal);
      continue;
    }

    if (communities.length > 0 || !hadCommunities) return communities;

    if (delayMs === undefined) throw new CommunityListNotSettledError();

    onWaiting?.();
    await waitBeforeRetry(delayMs, signal);
  }
}
