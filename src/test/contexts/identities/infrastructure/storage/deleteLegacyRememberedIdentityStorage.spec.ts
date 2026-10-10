import { deleteLegacyRememberedIdentityStorage } from '../../../../../contexts/identities/infrastructure/storage/deleteLegacyRememberedIdentityStorage';

const scopeModule =
  '../../../../../shared/infrastructure/storage/ClientStorageScope';

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => {
        values.delete(key);
      },
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

describe(deleteLegacyRememberedIdentityStorage.name, () => {
  it('removes the saved credentials and identity preview records', () => {
    values.set(
      'pigeon-swarm-credentials',
      JSON.stringify({ identityId: 'identity-1' }),
    );
    values.set(
      'pigeon-swarm-identity-preview',
      JSON.stringify({ identityId: 'identity-1', name: 'Ada' }),
    );
    values.set('pigeon-swarm-last-login-identity-v1', 'kept');

    deleteLegacyRememberedIdentityStorage();

    expect([...values.keys()]).toEqual(['pigeon-swarm-last-login-identity-v1']);
  });

  it('is a no-op when the records are absent', () => {
    deleteLegacyRememberedIdentityStorage();

    expect(values.size).toBe(0);
  });

  it('removes only the records scoped to the selected node', async () => {
    jest.resetModules();
    jest.doMock(scopeModule, () => ({
      scopeClientStorageKey: (key: string): string => `${key}:node`,
    }));

    try {
      // Dynamic import: the scope mock must apply before the key is read.
      const scoped =
        await import('../../../../../contexts/identities/infrastructure/storage/deleteLegacyRememberedIdentityStorage');

      values.set('pigeon-swarm-credentials:node', 'scoped');
      values.set('pigeon-swarm-credentials', 'combined');

      scoped.deleteLegacyRememberedIdentityStorage();

      expect(values.has('pigeon-swarm-credentials:node')).toBe(false);
      expect(values.get('pigeon-swarm-credentials')).toBe('combined');
    } finally {
      jest.dontMock(scopeModule);
      jest.resetModules();
    }
  });
});
