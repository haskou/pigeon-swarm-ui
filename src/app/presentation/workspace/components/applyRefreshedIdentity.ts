import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

/**
 * Applies an identity fetched for the session in state.
 *
 * The fetch started before it resolved, so it can predate an identity already
 * held, and it must not roll back a keychain published in the meantime. Only
 * the identity is replaced.
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

  // The user switched identities while fetching: discard the old identity.
  if (current.identity.id !== identityId) {
    return current;
  }

  // Identity versions only move forward: keep the newer identity already held.
  if (identity.version < current.identity.version) {
    return current;
  }

  return { ...current, identity };
}
