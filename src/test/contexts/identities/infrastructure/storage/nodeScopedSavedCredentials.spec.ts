const scopeModule =
  '../../../../../shared/infrastructure/storage/ClientStorageScope';

async function credentialsForNode(node: string) {
  jest.resetModules();
  jest.doMock(scopeModule, () => ({
    scopeClientStorageKey: (key: string): string => `${key}:${node}`,
  }));

  return await import('../../../../../contexts/identities/infrastructure/storage/savedCredentials');
}

describe('node-scoped remembered credentials', () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  });

  afterEach(() => {
    jest.dontMock(scopeModule);
    jest.resetModules();
  });

  it('does not restore another node credentials and preserves them when returning', async () => {
    const firstNode = await credentialsForNode('first');

    firstNode.saveCredentials({ identityId: 'identity-1' });
    const secondNode = await credentialsForNode('second');

    expect(secondNode.loadSavedCredentials()).toBeNull();
    secondNode.saveCredentials({ identityId: 'identity-2' });
    secondNode.clearSavedCredentials();
    const returnedNode = await credentialsForNode('first');

    expect(returnedNode.loadSavedCredentials()).toEqual({
      identityId: 'identity-1',
    });
  });

  it('does not inherit or delete combined-client credentials', async () => {
    const legacy = JSON.stringify({ identityId: 'legacy-identity' });

    values.set('pigeon-swarm-credentials', legacy);
    const node = await credentialsForNode('first');

    expect(node.loadSavedCredentials()).toBeNull();
    node.clearSavedCredentials();
    expect(values.get('pigeon-swarm-credentials')).toBe(legacy);
  });
});
