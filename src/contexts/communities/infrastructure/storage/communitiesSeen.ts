import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';

// A flag per identity: this device has listed at least one community for it.
// It tells a node that answers an empty list after a restart, while its
// replicated state is still opening, from a user who has no community yet.
// It holds no community id or key.
const storageKey = (identityId: string): string =>
  scopeClientStorageKey(`pigeon:communitiesSeen:${identityId}`);

export function forgetCommunitiesSeen(identityId: string): void {
  try {
    globalThis.localStorage?.removeItem(storageKey(identityId));
  } catch {
    // The flag only widens a re-read; losing it must not block anything.
  }
}

export function hasSeenCommunities(identityId: string): boolean {
  try {
    return globalThis.localStorage?.getItem(storageKey(identityId)) === '1';
  } catch {
    return false;
  }
}

export function rememberCommunitiesSeen(identityId: string): void {
  try {
    globalThis.localStorage?.setItem(storageKey(identityId), '1');
  } catch {
    // The flag only widens a re-read; losing it must not block anything.
  }
}
