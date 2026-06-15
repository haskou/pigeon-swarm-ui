import { KeyPair, SymmetricKey } from '@haskou/value-objects';

import type { IdentityResource } from '../../domain/IdentityResource';
import type { PasskeyPrfMasterKeyProtection } from '../../domain/PasskeyPrfMasterKeyProtection';

import { RecoveryKey } from '../../domain/value-objects/RecoveryKey';
import { UserRootKeyProtector } from './UserRootKeyProtector';
import { WebAuthnPrfKeyProtector } from './WebAuthnPrfKeyProtector';

const testDerivationDefaults = {
  algorithm: 'scrypt',
  N: 16,
  p: 1,
  r: 1,
  version: 1,
} as const satisfies Omit<
  IdentityResource['masterKeyDerivation'],
  'passkeyPrf' | 'salt'
>;

class FakePasskeyPrfProtector {
  private readonly protection: PasskeyPrfMasterKeyProtection = {
    algorithm: 'webauthn-prf',
    credentialId: 'credential-id',
    salt: 'salt',
    version: 1,
  };

  public constructor(
    private readonly prfKey: SymmetricKey,
    private readonly shouldReject = false,
  ) {}

  public createProtection(): Promise<{
    prfKey: SymmetricKey;
    protection: PasskeyPrfMasterKeyProtection;
  }> {
    if (this.shouldReject) return Promise.reject(new Error('PRF unavailable'));

    return Promise.resolve({
      prfKey: this.prfKey,
      protection: this.protection,
    });
  }

  public evaluateKey(): Promise<SymmetricKey> {
    if (this.shouldReject) return Promise.reject(new Error('PRF unavailable'));

    return Promise.resolve(this.prfKey);
  }
}

function createIdentity({
  encryptedMasterKey,
  keyPair,
  masterKey,
  masterKeyDerivation,
}: {
  encryptedMasterKey: string;
  keyPair: KeyPair;
  masterKey: SymmetricKey;
  masterKeyDerivation: IdentityResource['masterKeyDerivation'];
}): IdentityResource {
  const protector = new UserRootKeyProtector(
    new FakePasskeyPrfProtector(
      SymmetricKey.generate(),
    ) as unknown as WebAuthnPrfKeyProtector,
    testDerivationDefaults,
  );
  const encryptedKeyPair = protector.protectIdentityKeyPair(keyPair, masterKey);

  return {
    encryptedKeyPair,
    encryptedMasterKey,
    id: encryptedKeyPair.publicKey,
    masterKeyDerivation,
    networks: [],
    profile: { name: 'Ada' },
    signature: 'signature',
    timestamp: 1,
    version: 1,
  };
}

describe(UserRootKeyProtector.name, () => {
  it('protects the user root key with password and passkey PRF without storing password-key material', async () => {
    const masterKey = SymmetricKey.generate();
    const passkeyPrf = new FakePasskeyPrfProtector(SymmetricKey.generate());
    const protector = new UserRootKeyProtector(
      passkeyPrf as unknown as WebAuthnPrfKeyProtector,
      testDerivationDefaults,
    );

    const protectedRoot = await protector.protectMasterKey({
      masterKey,
      passkeyPrf: {
        displayName: 'Ada',
        identityId: 'identity-id',
        mode: 'create',
      },
      password: 'correct horse battery staple',
    });
    const identity = createIdentity({
      encryptedMasterKey: protectedRoot.encryptedMasterKey,
      keyPair: await KeyPair.generate(),
      masterKey,
      masterKeyDerivation: protectedRoot.masterKeyDerivation,
    });

    const unlocked = await protector.unlockMasterKey(
      identity,
      'correct horse battery staple',
    );

    expect(unlocked.isEqual(masterKey)).toBe(true);
    expect(protectedRoot.masterKeyDerivation.passkeyPrf).toMatchObject({
      algorithm: 'webauthn-prf',
      credentialId: 'credential-id',
      salt: 'salt',
      version: 1,
    });
    expect(
      'encryptedPasswordKey' in protectedRoot.masterKeyDerivation.passkeyPrf!,
    ).toBe(false);
  });

  it('keeps the identity public key stable when changing password', async () => {
    const masterKey = SymmetricKey.generate();
    const keyPair = await KeyPair.generate();
    const passkeyPrf = new FakePasskeyPrfProtector(SymmetricKey.generate());
    const protector = new UserRootKeyProtector(
      passkeyPrf as unknown as WebAuthnPrfKeyProtector,
      testDerivationDefaults,
    );
    const initial = await protector.protectMasterKey({
      masterKey,
      passkeyPrf: {
        displayName: 'Ada',
        identityId: 'identity-id',
        mode: 'create',
      },
      password: 'old password',
    });
    const encryptedKeyPair = protector.protectIdentityKeyPair(
      keyPair,
      masterKey,
    );
    const rewrapped = await protector.protectMasterKey({
      masterKey,
      passkeyPrf: {
        mode: 'preserve',
        protection: initial.masterKeyDerivation.passkeyPrf!,
      },
      password: 'new password',
    });
    const identity = {
      encryptedKeyPair,
      encryptedMasterKey: rewrapped.encryptedMasterKey,
      id: encryptedKeyPair.publicKey,
      masterKeyDerivation: rewrapped.masterKeyDerivation,
      networks: [],
      profile: { name: 'Ada' },
      signature: 'signature',
      timestamp: 1,
      version: 1,
    } satisfies IdentityResource;

    const unlockedMasterKey = await protector.unlockMasterKey(
      identity,
      'new password',
    );
    const unlockedKeyPair = protector.unlockIdentityKeyPair(
      identity,
      unlockedMasterKey,
    );

    expect(unlockedMasterKey.isEqual(masterKey)).toBe(true);
    expect(identity.encryptedKeyPair.publicKey).toBe(
      keyPair.toPrimitives().publicKey,
    );
    expect(
      unlockedKeyPair.isValidSignature(
        'payload',
        unlockedKeyPair.sign('payload'),
      ),
    ).toBe(true);
  });

  it('rejects password-only unlocks for passkey protected identities', async () => {
    const masterKey = SymmetricKey.generate();
    const passkeyPrf = new FakePasskeyPrfProtector(SymmetricKey.generate());
    const protector = new UserRootKeyProtector(
      passkeyPrf as unknown as WebAuthnPrfKeyProtector,
      testDerivationDefaults,
    );
    const protectedRoot = await protector.protectMasterKey({
      masterKey,
      passkeyPrf: {
        displayName: 'Ada',
        identityId: 'identity-id',
        mode: 'create',
      },
      password: 'correct password',
    });
    const wrongPasskeyProtector = new UserRootKeyProtector(
      new FakePasskeyPrfProtector(
        SymmetricKey.generate(),
      ) as unknown as WebAuthnPrfKeyProtector,
      testDerivationDefaults,
    );
    const identity = createIdentity({
      encryptedMasterKey: protectedRoot.encryptedMasterKey,
      keyPair: await KeyPair.generate(),
      masterKey,
      masterKeyDerivation: protectedRoot.masterKeyDerivation,
    });

    await expect(
      wrongPasskeyProtector.unlockMasterKey(identity, 'correct password'),
    ).rejects.toThrow();
  });

  it('protects the user root key with password and recovery key', async () => {
    const masterKey = SymmetricKey.generate();
    const recoveryKey = RecoveryKey.generate();
    const protector = new UserRootKeyProtector(
      new FakePasskeyPrfProtector(
        SymmetricKey.generate(),
        true,
      ) as unknown as WebAuthnPrfKeyProtector,
      testDerivationDefaults,
    );
    const protectedRoot = await protector.protectMasterKey({
      masterKey,
      password: 'correct password',
      recoveryKey,
    });
    const identity = createIdentity({
      encryptedMasterKey: protectedRoot.encryptedMasterKey,
      keyPair: await KeyPair.generate(),
      masterKey,
      masterKeyDerivation: protectedRoot.masterKeyDerivation,
    });

    const unlocked = await protector.unlockMasterKey(
      identity,
      'correct password',
      recoveryKey,
    );

    expect(unlocked.isEqual(masterKey)).toBe(true);
    expect(protectedRoot.masterKeyDerivation.recoveryKey).toMatchObject({
      algorithm: 'pigeon-recovery-key',
      version: 1,
    });
    expect(protectedRoot.masterKeyDerivation.passkeyPrf).toBeUndefined();
  });

  it('rejects password-only unlocks for recovery protected identities', async () => {
    const masterKey = SymmetricKey.generate();
    const protector = new UserRootKeyProtector(
      new FakePasskeyPrfProtector(
        SymmetricKey.generate(),
        true,
      ) as unknown as WebAuthnPrfKeyProtector,
      testDerivationDefaults,
    );
    const protectedRoot = await protector.protectMasterKey({
      masterKey,
      password: 'correct password',
      recoveryKey: RecoveryKey.generate(),
    });
    const identity = createIdentity({
      encryptedMasterKey: protectedRoot.encryptedMasterKey,
      keyPair: await KeyPair.generate(),
      masterKey,
      masterKeyDerivation: protectedRoot.masterKeyDerivation,
    });

    await expect(
      protector.unlockMasterKey(identity, 'correct password'),
    ).rejects.toThrow('Recovery key is required');
  });

  it('rejects wrong recovery keys for recovery protected identities', async () => {
    const masterKey = SymmetricKey.generate();
    const protector = new UserRootKeyProtector(
      new FakePasskeyPrfProtector(
        SymmetricKey.generate(),
        true,
      ) as unknown as WebAuthnPrfKeyProtector,
      testDerivationDefaults,
    );
    const protectedRoot = await protector.protectMasterKey({
      masterKey,
      password: 'correct password',
      recoveryKey: RecoveryKey.generate(),
    });
    const identity = createIdentity({
      encryptedMasterKey: protectedRoot.encryptedMasterKey,
      keyPair: await KeyPair.generate(),
      masterKey,
      masterKeyDerivation: protectedRoot.masterKeyDerivation,
    });

    await expect(
      protector.unlockMasterKey(
        identity,
        'correct password',
        RecoveryKey.generate(),
      ),
    ).rejects.toThrow();
  });

  it('does not fall back to password-only when a passkey protected identity cannot evaluate PRF', async () => {
    const masterKey = SymmetricKey.generate();
    const passkeyPrf = new FakePasskeyPrfProtector(SymmetricKey.generate());
    const protector = new UserRootKeyProtector(
      passkeyPrf as unknown as WebAuthnPrfKeyProtector,
      testDerivationDefaults,
    );
    const protectedRoot = await protector.protectMasterKey({
      masterKey,
      passkeyPrf: {
        displayName: 'Ada',
        identityId: 'identity-id',
        mode: 'create',
      },
      password: 'correct password',
    });
    const identity = createIdentity({
      encryptedMasterKey: protectedRoot.encryptedMasterKey,
      keyPair: await KeyPair.generate(),
      masterKey,
      masterKeyDerivation: protectedRoot.masterKeyDerivation,
    });
    const rejectingProtector = new UserRootKeyProtector(
      new FakePasskeyPrfProtector(
        SymmetricKey.generate(),
        true,
      ) as unknown as WebAuthnPrfKeyProtector,
      testDerivationDefaults,
    );

    await expect(
      rejectingProtector.unlockMasterKey(identity, 'correct password'),
    ).rejects.toThrow('PRF unavailable');
  });

  it('unlocks portable password-only identities without passkey PRF', async () => {
    const masterKey = SymmetricKey.generate();
    const protector = new UserRootKeyProtector(
      new FakePasskeyPrfProtector(
        SymmetricKey.generate(),
        true,
      ) as unknown as WebAuthnPrfKeyProtector,
      testDerivationDefaults,
    );
    const protectedRoot = await protector.protectMasterKey({
      masterKey,
      password: 'correct password',
    });
    const identity = createIdentity({
      encryptedMasterKey: protectedRoot.encryptedMasterKey,
      keyPair: await KeyPair.generate(),
      masterKey,
      masterKeyDerivation: protectedRoot.masterKeyDerivation,
    });

    const unlocked = await protector.unlockMasterKey(
      identity,
      'correct password',
    );

    expect(protectedRoot.masterKeyDerivation.passkeyPrf).toBeUndefined();
    expect(unlocked.isEqual(masterKey)).toBe(true);
  });
});
