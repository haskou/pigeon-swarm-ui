import { KeyPair, SymmetricKey } from '@haskou/value-objects';

import type {
  IdentityResource,
  Session,
} from '../../../shared/domain/pigeonResources.types';

import { UserRootKeyProtector } from '../../../contexts/identities/infrastructure/crypto/UserRootKeyProtector';
import { copy } from '../../../shared/presentation/i18n/copy';
import { PigeonIdentityKeyProtectionGateway } from './PigeonIdentityKeyProtectionGateway';

describe(PigeonIdentityKeyProtectionGateway.name, () => {
  function identityWithPasskey(): IdentityResource {
    return {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: 'public-key',
      },
      encryptedMasterKey: 'encrypted-master-key',
      id: 'identity-1',
      masterKeyDerivation: {
        algorithm: 'scrypt',
        N: 262_144,
        p: 1,
        passkeyPrf: {
          algorithm: 'webauthn-prf',
          credentialId: 'credential-1',
          salt: 'salt',
          version: 1,
        },
        r: 8,
        salt: 'password-salt',
        version: 1,
      },
      networks: [],
      profile: { name: 'Ada' },
      timestamp: 1,
      version: 1,
    } as unknown as IdentityResource;
  }

  function protectorDouble(): jest.Mocked<UserRootKeyProtector> {
    return {
      protectIdentityKeyPair: jest.fn(),
      protectMasterKey: jest.fn(),
      unlockIdentityKeyPair: jest.fn(),
      unlockMasterKey: jest.fn(),
    } as unknown as jest.Mocked<UserRootKeyProtector>;
  }

  it('requires passkey confirmation only when no recovery key was supplied', () => {
    const gateway = new PigeonIdentityKeyProtectionGateway(protectorDouble());
    const identity = identityWithPasskey();

    expect(gateway.shouldConfirmPasskey(identity)).toBe(true);
    expect(gateway.shouldConfirmPasskey(identity, 'recovery-key')).toBe(false);
  });

  it('keeps passkey PRF enabled when new identity recovery is also configured', () => {
    const gateway = new PigeonIdentityKeyProtectionGateway(protectorDouble());

    expect(
      gateway.registrationPasskeyPrfMode({
        displayName: 'Ada',
        enabled: true,
        identityId: 'identity-1',
      }),
    ).toEqual({
      displayName: 'Ada',
      identityId: 'identity-1',
      mode: 'create',
    });
  });

  it('preserves profile passkey protection unless explicitly disabled', async () => {
    const protector = protectorDouble();
    const gateway = new PigeonIdentityKeyProtectionGateway(protector);
    const identity = identityWithPasskey();
    const masterKey = SymmetricKey.generate();
    protector.protectMasterKey.mockResolvedValue({
      encryptedMasterKey: 'encrypted-master-key',
      masterKeyDerivation: identity.masterKeyDerivation,
    });

    await gateway.protectProfileMasterKey({
      currentIdentity: identity,
      identityId: identity.id,
      newPassword: 'new correct horse battery staple',
      options: {},
      profile: { name: 'Ada' },
      session: { masterKey } as unknown as Session,
    });

    expect(protector.protectMasterKey).toHaveBeenCalledWith(
      expect.objectContaining({
        passkeyPrf: {
          mode: 'preserve',
          protection: identity.masterKeyDerivation.passkeyPrf,
        },
      }),
    );

    await gateway.protectProfileMasterKey({
      currentIdentity: identity,
      identityId: identity.id,
      newPassword: 'another correct horse battery staple',
      options: { passkeyPrfEnabled: false },
      profile: { name: 'Ada' },
      session: { masterKey } as unknown as Session,
    });

    expect(protector.protectMasterKey).toHaveBeenLastCalledWith(
      expect.objectContaining({ passkeyPrf: undefined }),
    );
  });

  it('protects a new identity without replacing its key pair', async () => {
    const protector = protectorDouble();
    const gateway = new PigeonIdentityKeyProtectionGateway(protector);
    const keyPair = await KeyPair.generate();
    const masterKey = SymmetricKey.generate();
    const encryptedKeyPair = {
      encryptedPrivateKey: 'encrypted-private-key',
      publicKey: keyPair.toPrimitives().publicKey,
    };
    protector.protectIdentityKeyPair.mockReturnValue(encryptedKeyPair);
    protector.protectMasterKey.mockResolvedValue({
      encryptedMasterKey: 'encrypted-master-key',
      masterKeyDerivation: identityWithPasskey().masterKeyDerivation,
    });

    const result = await gateway.protectNewIdentity({
      displayName: 'Ada',
      identityId: 'identity-1',
      keyPair,
      masterKey,
      options: { passkeyPrfEnabled: true },
      password: 'correct horse battery staple',
    });

    expect(result.encryptedKeyPair).toBe(encryptedKeyPair);
    expect(protector.protectIdentityKeyPair).toHaveBeenCalledWith(
      keyPair,
      masterKey,
    );
  });

  it('rejects malformed recovery keys before attempting an unlock', async () => {
    const protector = protectorDouble();
    const gateway = new PigeonIdentityKeyProtectionGateway(protector);

    await expect(
      gateway.unlockLoginMasterKey({
        identity: identityWithPasskey(),
        password: 'correct horse battery staple',
        recoveryKey: 'invalid',
      }),
    ).rejects.toThrow(copy.auth.recoveryKeyUnlockFailed);

    expect(protector.unlockMasterKey).not.toHaveBeenCalled();
  });

  it('reports a passkey unlock failure without falling back to password-only', async () => {
    const protector = protectorDouble();
    protector.unlockMasterKey.mockRejectedValue(new Error('PRF unavailable'));
    const gateway = new PigeonIdentityKeyProtectionGateway(protector);

    await expect(
      gateway.unlockLoginMasterKey({
        identity: identityWithPasskey(),
        password: 'correct horse battery staple',
      }),
    ).rejects.toThrow(copy.auth.passkeyPrfUnlockFailed);
  });
});
