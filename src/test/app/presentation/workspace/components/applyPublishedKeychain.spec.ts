import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { applyPublishedKeychain } from '../../../../../app/presentation/workspace/components/applyPublishedKeychain';

describe(applyPublishedKeychain.name, () => {
  function sessionAt(
    identityId: string,
    version: number,
    externalId: string | null,
  ): Session {
    return {
      identity: { id: identityId, version: 1 },
      keychain: { conversations: {}, version },
      keychainExternalIdentifier: externalId,
    } as unknown as Session;
  }

  it('applies a keychain published from a snapshot and keeps the current identity', () => {
    const current = sessionAt('identity-1', 2, 'cid-2');
    const published = sessionAt('identity-1', 3, 'cid-3');

    const next = applyPublishedKeychain(current, 'identity-1', published);

    expect(next).not.toBeNull();
    expect(next?.keychain).toBe(published.keychain);
    expect(next?.keychainExternalIdentifier).toBe('cid-3');
    expect(next?.identity).toBe(current.identity);
  });

  it('keeps the current keychain when the snapshot predates a newer publish', () => {
    const current = sessionAt('identity-1', 3, 'cid-3');
    const stale = sessionAt('identity-1', 2, 'cid-2');

    expect(applyPublishedKeychain(current, 'identity-1', stale)).toBe(current);
  });

  it('does not apply a publish to a different identity', () => {
    const current = sessionAt('identity-2', 1, 'cid-b');
    const published = sessionAt('identity-1', 3, 'cid-3');

    expect(applyPublishedKeychain(current, 'identity-1', published)).toBe(
      current,
    );
  });

  it('does not resurrect a session that was cleared before the publish landed', () => {
    const published = sessionAt('identity-1', 3, 'cid-3');

    expect(applyPublishedKeychain(null, 'identity-1', published)).toBeNull();
  });

  it('applies a publish whose identity id is the PEM form of the current one', () => {
    const current = sessionAt('MCowBQYDK2VwAyEAidentity', 2, 'cid-2');
    const published = sessionAt('MCowBQYDK2VwAyEAidentity', 3, 'cid-3');
    const pem =
      '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAidentity\n-----END PUBLIC KEY-----\n';

    expect(applyPublishedKeychain(current, pem, published)?.keychain).toBe(
      published.keychain,
    );
  });
});
