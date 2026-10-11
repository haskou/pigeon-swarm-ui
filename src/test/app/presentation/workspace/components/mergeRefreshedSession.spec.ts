import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { mergeRefreshedSession } from '../../../../../app/presentation/workspace/components/mergeRefreshedSession';

describe(mergeRefreshedSession.name, () => {
  function sessionAt(
    identityId: string,
    version: number,
    externalId: string | null,
  ): Session {
    return {
      identity: { id: identityId },
      keychain: { conversations: {}, version },
      keychainExternalIdentifier: externalId,
    } as unknown as Session;
  }

  it('applies a refreshed session that is at least as new as the current one', () => {
    const current = sessionAt('identity-1', 2, 'cid-2');
    const refreshed = sessionAt('identity-1', 3, 'cid-3');

    expect(mergeRefreshedSession(current, refreshed)).toBe(refreshed);
  });

  it('keeps the current keychain when the refresh started before a newer publish', () => {
    const current = sessionAt('identity-1', 3, 'cid-3');
    const refreshed = sessionAt('identity-1', 2, 'cid-2');

    expect(mergeRefreshedSession(current, refreshed)).toBe(current);
  });

  it('keeps the current keychain when the refresh found no keychain', () => {
    const current = sessionAt('identity-1', 3, 'cid-3');
    const refreshed = sessionAt('identity-1', 0, null);

    expect(mergeRefreshedSession(current, refreshed)).toBe(current);
  });

  it('does not resurrect a session that was cleared while refreshing', () => {
    const refreshed = sessionAt('identity-1', 3, 'cid-3');

    expect(mergeRefreshedSession(null, refreshed)).toBeNull();
  });

  it('does not apply a refresh result to a different identity', () => {
    const current = sessionAt('identity-2', 1, 'cid-b');
    const refreshed = sessionAt('identity-1', 3, 'cid-3');

    expect(mergeRefreshedSession(current, refreshed)).toBe(current);
  });
});
