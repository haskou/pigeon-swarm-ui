import { KeyPair, SHA256Hash, SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';

import type { PigeonDeviceAuthorizationApi } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';
import type { DeviceIdentityVaultStore } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVaultStore';
import type {
  IdentityResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceId } from '../../../../../contexts/identities/domain/value-objects/DeviceId';
import { DeviceUnlockSecretHandle } from '../../../../../contexts/identities/domain/value-objects/DeviceUnlockSecretHandle';
import { PigeonIdentityGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityGateway';
import { PigeonIdentitySessionApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentitySessionApi';
import { DeviceIdentityVault } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVault';
import { copy } from '../../../../../shared/presentation/i18n/copy';

function identity(id: string): IdentityResource {
  return {
    admissionNonce: '0',
    authorizationRevision: 0,
    deviceCredential: 'device-credential',
    deviceCredentialCommitment: 'device-commitment',
    id,
    networks: [],
    profile: { name: 'Ada' },
    recoveryAuthority: 'recovery-authority',
    signature: 'signature',
    timestamp: 1,
    version: 1,
  };
}

describe(PigeonIdentitySessionApi.name, () => {
  it('unlocks the identity and validates the recovered key pair', async () => {
    const keyPair = await KeyPair.generate();
    const currentIdentity = identity(keyPair.toPrimitives().publicKey);
    const masterKey = SymmetricKey.generate();
    const identities = {
      get: jest.fn().mockResolvedValue(currentIdentity),
    } as unknown as PigeonIdentityGateway;
    const deviceCredentialKeyPair = await KeyPair.generate();
    const recoveryAuthorityKeyPair = await KeyPair.generate();
    currentIdentity.deviceCredential =
      deviceCredentialKeyPair.toPrimitives().publicKey;
    currentIdentity.deviceCredentialCommitment = SHA256Hash.from(
      new StringValueObject(currentIdentity.deviceCredential),
    ).valueOf();
    currentIdentity.recoveryAuthority =
      recoveryAuthorityKeyPair.toPrimitives().publicKey;
    const vault = {
      unlock: jest.fn().mockResolvedValue({
        authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
        authorizationRevision: DeviceAuthorizationRevision.initial(),
        deviceId: DeviceId.generate(),
        material: {
          deviceCredentialKeyPair,
          identityKeyPair: keyPair,
          recoveryAuthorityKeyPair,
          rootKey: {
            getBuffer: () => masterKey.getBuffer(),
          },
        },
        secretHandle: DeviceUnlockSecretHandle.generate(),
      }),
    } as unknown as DeviceIdentityVault;
    const deviceAuthorization = {
      synchronize: jest
        .fn()
        .mockImplementation((session: Session) => Promise.resolve(session)),
    } as unknown as PigeonDeviceAuthorizationApi;
    const sessionApi = new PigeonIdentitySessionApi(
      identities,
      vault,
      deviceAuthorization,
    );

    await expect(
      sessionApi.unlock(' @ada ', 'password'),
    ).resolves.toMatchObject({
      deviceCredentialKeyPair,
      identity: currentIdentity,
      keychain: { conversations: {}, version: 0 },
      keyPair,
      masterKey,
      recoveryAuthorityKeyPair,
    });

    expect(identities.get).toHaveBeenCalledWith('@ada');
    expect(vault.unlock).toHaveBeenCalledWith(expect.any(Object), 'password');
    expect(deviceAuthorization.synchronize).toHaveBeenCalledWith(
      expect.objectContaining({ deviceCredentialKeyPair }),
    );
  });

  it('fails closed when published authorization is newer than the local checkpoint', async () => {
    const keyPair = await KeyPair.generate();
    const currentIdentity = identity(keyPair.toPrimitives().publicKey);
    currentIdentity.authorizationRevision = 2;
    const identities = {
      get: jest.fn().mockResolvedValue(currentIdentity),
    } as unknown as PigeonIdentityGateway;
    const vault = {
      unlock: jest.fn().mockResolvedValue({
        authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
        authorizationRevision: DeviceAuthorizationRevision.initial(),
        deviceId: DeviceId.generate(),
        material: {
          deviceCredentialKeyPair: await KeyPair.generate(),
          identityKeyPair: keyPair,
          recoveryAuthorityKeyPair: await KeyPair.generate(),
          rootKey: { getBuffer: () => SymmetricKey.generate().getBuffer() },
        },
        secretHandle: DeviceUnlockSecretHandle.generate(),
      }),
    } as unknown as DeviceIdentityVault;

    await expect(
      new PigeonIdentitySessionApi(identities, vault, {
        synchronize: jest.fn(),
      } as unknown as PigeonDeviceAuthorizationApi).unlock(
        currentIdentity.id,
        'password',
      ),
    ).rejects.toThrow();
  });

  it('explains a missing local device key instead of reporting a wrong password', async () => {
    const keyPair = await KeyPair.generate();
    const currentIdentity = identity(keyPair.toPrimitives().publicKey);
    const identities = {
      get: jest.fn().mockResolvedValue(currentIdentity),
    } as unknown as PigeonIdentityGateway;
    const store = {
      find: jest.fn().mockResolvedValue(undefined),
    } as unknown as DeviceIdentityVaultStore;
    const sessionApi = new PigeonIdentitySessionApi(
      identities,
      new DeviceIdentityVault(store),
      { synchronize: jest.fn() } as unknown as PigeonDeviceAuthorizationApi,
    );

    const unlock = sessionApi.unlock(currentIdentity.id, 'password');

    await expect(unlock).rejects.toThrow(copy.auth.localDeviceMissing);
    await expect(unlock).rejects.not.toThrow(copy.auth.invalidLogin);
  });

  it('keeps the generic message when the local device key cannot be opened', async () => {
    const keyPair = await KeyPair.generate();
    const currentIdentity = identity(keyPair.toPrimitives().publicKey);
    const identities = {
      get: jest.fn().mockResolvedValue(currentIdentity),
    } as unknown as PigeonIdentityGateway;
    const vault = {
      unlock: jest.fn().mockRejectedValue(new Error('Wrong password.')),
    } as unknown as DeviceIdentityVault;

    await expect(
      new PigeonIdentitySessionApi(identities, vault, {
        synchronize: jest.fn(),
      } as unknown as PigeonDeviceAuthorizationApi).unlock(
        currentIdentity.id,
        'wrong password',
      ),
    ).rejects.toThrow(copy.auth.invalidLogin);
  });
});
