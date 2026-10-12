import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { applyRefreshedIdentity } from '../../../../../app/presentation/workspace/components/applyRefreshedIdentity';

describe(applyRefreshedIdentity.name, () => {
  function sessionAt(
    identityId: string,
    identityVersion: number,
    keychainVersion: number,
  ): Session {
    return {
      identity: { id: identityId, version: identityVersion },
      keychain: { conversations: {}, version: keychainVersion },
      keychainExternalIdentifier: `cid-${keychainVersion}`,
    } as unknown as Session;
  }

  function identityAt(identityId: string, version: number): IdentityResource {
    return { id: identityId, version } as unknown as IdentityResource;
  }

  it('applies a fetched identity at least as new as the current one', () => {
    const current = sessionAt('identity-1', 1, 2);
    const fetched = identityAt('identity-1', 2);

    const next = applyRefreshedIdentity(current, 'identity-1', fetched);

    expect(next?.identity).toBe(fetched);
  });

  it('keeps a keychain published while the identity fetch was in flight', () => {
    const current = sessionAt('identity-1', 1, 3);
    const fetched = identityAt('identity-1', 2);

    const next = applyRefreshedIdentity(current, 'identity-1', fetched);

    expect(next?.keychain).toBe(current.keychain);
    expect(next?.keychainExternalIdentifier).toBe('cid-3');
  });

  it('ignores a fetched identity older than the one already held', () => {
    const current = sessionAt('identity-1', 3, 2);
    const stale = identityAt('identity-1', 2);

    expect(applyRefreshedIdentity(current, 'identity-1', stale)).toBe(current);
  });

  it('does not apply a fetched identity to a different session identity', () => {
    const current = sessionAt('identity-2', 1, 1);
    const fetched = identityAt('identity-1', 5);

    expect(applyRefreshedIdentity(current, 'identity-1', fetched)).toBe(
      current,
    );
  });

  it('does not resurrect a session that was cleared while fetching', () => {
    const fetched = identityAt('identity-1', 2);

    expect(applyRefreshedIdentity(null, 'identity-1', fetched)).toBeNull();
  });
});
