import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { mergeSessionSnapshot } from '../../../../../app/presentation/workspace/components/mergeSessionSnapshot';

describe(mergeSessionSnapshot.name, () => {
  function sessionAt({
    externalId = null,
    identityId = 'identity-1',
    identityName = 'Ada',
    identityVersion = 1,
    keychainVersion,
  }: {
    externalId?: string | null;
    identityId?: string;
    identityName?: string;
    identityVersion?: number;
    keychainVersion: number;
  }): Session {
    return {
      identity: {
        id: identityId,
        profile: { name: identityName },
        version: identityVersion,
      },
      keychain: { conversations: {}, version: keychainVersion },
      keychainExternalIdentifier: externalId,
    } as unknown as Session;
  }

  it('applies a refreshed session that is at least as new as the current one', () => {
    const current = sessionAt({ externalId: 'cid-2', keychainVersion: 2 });
    const refreshed = sessionAt({ externalId: 'cid-3', keychainVersion: 3 });

    expect(mergeSessionSnapshot(current, refreshed)).toStrictEqual(refreshed);
  });

  it('keeps the current keychain when the refresh started before a newer publish', () => {
    const current = sessionAt({ externalId: 'cid-3', keychainVersion: 3 });
    const refreshed = sessionAt({ externalId: 'cid-2', keychainVersion: 2 });
    const merged = mergeSessionSnapshot(current, refreshed);

    expect(merged?.keychain).toBe(current.keychain);
    expect(merged?.keychainExternalIdentifier).toBe('cid-3');
  });

  it('keeps the current keychain when the refresh found no keychain', () => {
    const current = sessionAt({ externalId: 'cid-3', keychainVersion: 3 });
    const refreshed = sessionAt({ externalId: null, keychainVersion: 0 });
    const merged = mergeSessionSnapshot(current, refreshed);

    expect(merged?.keychain).toBe(current.keychain);
    expect(merged?.keychainExternalIdentifier).toBe('cid-3');
  });

  it('keeps the current identity when the snapshot predates a newer profile update', () => {
    const current = sessionAt({
      identityName: 'Grace',
      identityVersion: 3,
      keychainVersion: 1,
    });
    const refreshed = sessionAt({
      identityName: 'Ada',
      identityVersion: 2,
      keychainVersion: 1,
    });
    const merged = mergeSessionSnapshot(current, refreshed);

    expect(merged?.identity).toBe(current.identity);
  });

  it('applies a newer identity without rolling back a newer keychain', () => {
    const current = sessionAt({ externalId: 'cid-3', keychainVersion: 3 });
    const refreshed = sessionAt({
      externalId: 'cid-2',
      identityName: 'Grace',
      identityVersion: 2,
      keychainVersion: 2,
    });
    const merged = mergeSessionSnapshot(current, refreshed);

    expect(merged?.identity).toBe(refreshed.identity);
    expect(merged?.keychain).toBe(current.keychain);
    expect(merged?.keychainExternalIdentifier).toBe('cid-3');
  });

  it('does not resurrect a session that was cleared while refreshing', () => {
    const refreshed = sessionAt({ externalId: 'cid-3', keychainVersion: 3 });

    expect(mergeSessionSnapshot(null, refreshed)).toBeNull();
  });

  it('does not apply a session snapshot to a different identity', () => {
    const current = sessionAt({ identityId: 'identity-2', keychainVersion: 1 });
    const refreshed = sessionAt({
      identityId: 'identity-1',
      identityVersion: 3,
      keychainVersion: 3,
    });

    expect(mergeSessionSnapshot(current, refreshed)).toBe(current);
  });
});
