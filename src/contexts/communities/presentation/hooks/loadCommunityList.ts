import {
  hasSeenCommunities,
  rememberCommunitiesSeen,
} from '../../infrastructure/storage/communitiesSeen';
import { type CommunityListLoad } from './CommunityListLoad';
import { CommunityListNotSettledError } from './CommunityListNotSettledError';
import { readCommunitiesUntilSettled } from './readCommunitiesUntilSettled';

type LoadCommunityListOptions<T> = {
  delaysMs?: number[];
  load: CommunityListLoad;
  onFailed: (caught: unknown) => void;
  onSettled: (communities: T[]) => void;
  /**
   * Called instead of `onFailed` when the node kept answering an empty list
   * for an identity this device listed communities for. Only the user can tell
   * that they were deleted or left on another device, so the flag is kept.
   */
  onUnsettled: () => void;
  onWaiting?: () => void;
  read: (signal: AbortSignal) => Promise<T[]>;
};

/**
 * Runs one community list load. Every write, the state sinks and the
 * "communities seen" flag alike, happens only while `load` is the current
 * load, so a loop that was replaced, cancelled or outlived its identity ends
 * without touching anything.
 */
export async function loadCommunityList<T>({
  delaysMs,
  load,
  onFailed,
  onSettled,
  onUnsettled,
  onWaiting,
  read,
}: LoadCommunityListOptions<T>): Promise<void> {
  if (!load.isCurrent()) return;

  let communities: T[];

  try {
    communities = await readCommunitiesUntilSettled({
      delaysMs,
      hadCommunities: hasSeenCommunities(load.identityId),
      onWaiting: () => {
        if (load.isCurrent()) onWaiting?.();
      },
      read,
      signal: load.signal,
    });
  } catch (caught: unknown) {
    if (!load.isCurrent()) return;

    if (caught instanceof CommunityListNotSettledError) onUnsettled();
    else onFailed(caught);

    return;
  }

  if (!load.isCurrent()) return;

  if (communities.length > 0) rememberCommunitiesSeen(load.identityId);

  onSettled(communities);
}
