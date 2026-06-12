import {
  clearSavedCredentials,
  loadSavedCredentials,
  saveCredentials,
} from './savedCredentials';

describe('savedCredentials', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
  });

  it('stores only the identity id', () => {
    saveCredentials({ identityId: 'identity-1' });

    expect(storage.get('pigeon-swarm-credentials')).toBe(
      JSON.stringify({ identityId: 'identity-1' }),
    );
  });

  it('removes legacy stored passwords when loading saved credentials', () => {
    storage.set(
      'pigeon-swarm-credentials',
      JSON.stringify({ identityId: 'identity-1', password: 'secret' }),
    );

    expect(loadSavedCredentials()).toEqual({ identityId: 'identity-1' });
    expect(storage.get('pigeon-swarm-credentials')).toBe(
      JSON.stringify({ identityId: 'identity-1' }),
    );
  });

  it('clears invalid saved credentials', () => {
    storage.set('pigeon-swarm-credentials', JSON.stringify({ password: 'x' }));

    expect(loadSavedCredentials()).toBeNull();
    expect(storage.has('pigeon-swarm-credentials')).toBe(false);
  });

  it('clears saved credentials explicitly', () => {
    saveCredentials({ identityId: 'identity-1' });

    clearSavedCredentials();

    expect(storage.has('pigeon-swarm-credentials')).toBe(false);
  });
});
