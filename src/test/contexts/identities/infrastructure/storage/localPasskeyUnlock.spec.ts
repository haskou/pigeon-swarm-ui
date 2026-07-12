import {
  clearLocalPasskeyUnlock,
  loadLocalPasskeyUnlock,
  saveLocalPasskeyUnlock,
} from '../../../../../contexts/identities/infrastructure/storage/localPasskeyUnlock';

describe('local passkey unlock storage', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => storage.get(key) ?? null),
        removeItem: jest.fn((key: string) => storage.delete(key)),
        setItem: jest.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
      },
    });
  });

  it('stores and loads a local passkey envelope for an identity', () => {
    saveLocalPasskeyUnlock({
      encryptedMasterKey: 'encrypted-master-key',
      identityId: 'identity-1',
      masterKeyDerivation: {
        algorithm: 'scrypt',
        N: 16,
        p: 1,
        passkeyPrf: {
          algorithm: 'webauthn-prf',
          credentialId: 'credential-id',
          salt: 'salt',
          version: 1,
        },
        r: 1,
        salt: 'password-salt',
        version: 1,
      },
    });

    expect(loadLocalPasskeyUnlock('identity-1')).toMatchObject({
      encryptedMasterKey: 'encrypted-master-key',
      identityId: 'identity-1',
      masterKeyDerivation: {
        passkeyPrf: {
          credentialId: 'credential-id',
        },
      },
      version: 1,
    });
  });

  it('clears a stored local passkey envelope', () => {
    saveLocalPasskeyUnlock({
      encryptedMasterKey: 'encrypted-master-key',
      identityId: 'identity-1',
      masterKeyDerivation: {
        algorithm: 'scrypt',
        N: 16,
        p: 1,
        passkeyPrf: {
          algorithm: 'webauthn-prf',
          credentialId: 'credential-id',
          salt: 'salt',
          version: 1,
        },
        r: 1,
        salt: 'password-salt',
        version: 1,
      },
    });

    clearLocalPasskeyUnlock('identity-1');

    expect(loadLocalPasskeyUnlock('identity-1')).toBeUndefined();
  });
});
