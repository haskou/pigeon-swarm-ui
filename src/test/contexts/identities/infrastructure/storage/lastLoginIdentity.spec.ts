import {
  loadLastLoginIdentity,
  saveLastLoginIdentity,
} from '../../../../../contexts/identities/infrastructure/storage/lastLoginIdentity';

describe('lastLoginIdentity', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
  });

  it('is empty before an identity has logged in', () => {
    expect(loadLastLoginIdentity()).toBe('');
  });

  it('remembers only the normalized identity identifier', () => {
    saveLastLoginIdentity('  identity-id  ');

    expect(loadLastLoginIdentity()).toBe('identity-id');
  });

  it('ignores empty identifiers', () => {
    saveLastLoginIdentity('   ');

    expect(loadLastLoginIdentity()).toBe('');
  });
});
