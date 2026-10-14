import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { IdentityMatch } from '../../../../contexts/identities/domain/IdentityMatch';
import { IdentitySnapshotSelection } from '../../../../contexts/identities/domain/IdentitySnapshotSelection';
import { KeychainVersion } from '../../../../contexts/identities/domain/value-objects/KeychainVersion';

/**
 * Applies a keychain published for a session snapshot to the session in state.
 *
 * The publish was built from the snapshot it started with, so keys published
 * while it was in flight must not be rolled back. Only the keychain is taken
 * from the publish; the rest of the current session is kept.
 */
export function applyPublishedKeychain(
  current: Session | null,
  identityId: string,
  published: Pick<Session, 'keychain' | 'keychainExternalIdentifier'>,
): Session | null {
  // Logged out before the publish landed: do not resurrect the session.
  if (!current) {
    return null;
  }

  // The user switched identities while publishing: discard the old keychain.
  if (!IdentityMatch.isSame(current.identity.id, identityId)) {
    return current;
  }

  // Keychain versions only move forward: keep the newer keychain already held.
  if (
    IdentitySnapshotSelection.selectKeychain(
      KeychainVersion.fromNumber(current.keychain.version),
      KeychainVersion.fromNumber(published.keychain.version),
    ) === 'held'
  ) {
    return current;
  }

  return {
    ...current,
    keychain: published.keychain,
    keychainExternalIdentifier: published.keychainExternalIdentifier,
  };
}
