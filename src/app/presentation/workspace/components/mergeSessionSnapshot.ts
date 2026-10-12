import type { Session } from '../../../../shared/domain/pigeonResources.types';

/**
 * Applies a session snapshot (a refresh result or a whole-session update) to
 * the session currently held in state.
 *
 * A snapshot is built from the session it started with, so it can predate a
 * newer identity or keychain already in state. Each versioned part moves only
 * forward: the identity and the keychain are each kept from whichever side is
 * newer, and the rest of the snapshot is applied as given.
 */
export function mergeSessionSnapshot(
  current: Session | null,
  snapshot: Session,
): Session | null {
  // Logged out while the snapshot was in flight: do not resurrect the session.
  if (!current) {
    return null;
  }

  // The user switched identities while the snapshot was in flight: discard it.
  if (current.identity.id !== snapshot.identity.id) {
    return current;
  }

  // Identity versions only move forward: keep the newer identity already held.
  const identity =
    snapshot.identity.version < current.identity.version
      ? current.identity
      : snapshot.identity;

  // Keychain versions only move forward: keep the newer keychain already held.
  const keychainIsNewer = snapshot.keychain.version < current.keychain.version;

  return {
    ...snapshot,
    identity,
    keychain: keychainIsNewer ? current.keychain : snapshot.keychain,
    keychainExternalIdentifier: keychainIsNewer
      ? current.keychainExternalIdentifier
      : snapshot.keychainExternalIdentifier,
  };
}
