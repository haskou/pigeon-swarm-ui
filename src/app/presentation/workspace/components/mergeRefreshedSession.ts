import type { Session } from '../../../../shared/domain/pigeonResources.types';

/**
 * Applies a session refresh to the session currently held in state.
 *
 * A refresh starts from the session it was given, so its result can predate
 * keys published while it was in flight. Applying it must not roll them back.
 */
export function mergeRefreshedSession(
  current: Session | null,
  refreshed: Session,
): Session | null {
  // Logged out while refreshing: do not resurrect the session.
  if (!current) {
    return null;
  }

  // The user switched identities while refreshing: discard the old result.
  if (current.identity.id !== refreshed.identity.id) {
    return current;
  }

  // Keychain versions only move forward: keep the newer keychain already held.
  if (refreshed.keychain.version < current.keychain.version) {
    return current;
  }

  return refreshed;
}
