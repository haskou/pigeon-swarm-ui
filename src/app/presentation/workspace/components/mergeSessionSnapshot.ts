import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { IdentitySnapshotSelection } from '../../../../contexts/identities/domain/IdentitySnapshotSelection';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityVersion } from '../../../../contexts/identities/domain/value-objects/IdentityVersion';
import { KeychainVersion } from '../../../../contexts/identities/domain/value-objects/KeychainVersion';

/**
 * Applies a session snapshot (a refresh result or a whole-session update) to
 * the session currently held in state. The identities domain
 * `IdentitySnapshotSelection` decides which identity and keychain win; the
 * rest of the snapshot is applied as given.
 */
export function mergeSessionSnapshot(
  current: Session | null,
  snapshot: Session,
): Session | null {
  // Logged out while the snapshot was in flight: do not resurrect the session.
  if (!current) {
    return null;
  }

  const identityChoice = IdentitySnapshotSelection.selectIdentity(
    {
      id: IdentityId.fromString(current.identity.id),
      version: IdentityVersion.fromNumber(current.identity.version),
    },
    {
      id: IdentityId.fromString(snapshot.identity.id),
      version: IdentityVersion.fromNumber(snapshot.identity.version),
    },
  );

  if (identityChoice === 'discard') {
    return current;
  }

  const keychainSource =
    IdentitySnapshotSelection.selectKeychain(
      KeychainVersion.fromNumber(current.keychain.version),
      KeychainVersion.fromNumber(snapshot.keychain.version),
    ) === 'held'
      ? current
      : snapshot;

  return {
    ...snapshot,
    identity: identityChoice === 'held' ? current.identity : snapshot.identity,
    keychain: keychainSource.keychain,
    keychainExternalIdentifier: keychainSource.keychainExternalIdentifier,
  };
}
