import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { IdentitySnapshotSelection } from '../../../../contexts/identities/domain/IdentitySnapshotSelection';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityVersion } from '../../../../contexts/identities/domain/value-objects/IdentityVersion';

/**
 * Applies an identity fetched for the session in state. The identities domain
 * `IdentitySnapshotSelection` decides whether it wins: a fetch for another
 * identity or an older version is dropped. Only the identity is replaced, so a
 * keychain published in the meantime is never rolled back.
 */
export function applyRefreshedIdentity(
  current: Session | null,
  identityId: string,
  identity: IdentityResource,
): Session | null {
  // Logged out while fetching: do not resurrect the session.
  if (!current) {
    return null;
  }

  const choice = IdentitySnapshotSelection.selectIdentity(
    {
      id: IdentityId.fromString(current.identity.id),
      version: IdentityVersion.fromNumber(current.identity.version),
    },
    {
      id: IdentityId.fromString(identityId),
      version: IdentityVersion.fromNumber(identity.version),
    },
  );

  return choice === 'incoming' ? { ...current, identity } : current;
}
