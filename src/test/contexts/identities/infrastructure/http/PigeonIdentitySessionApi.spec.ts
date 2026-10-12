import { KeyPair, SHA256Hash, SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';

import type { DeviceSealedRecovery } from '../../../../../contexts/identities/infrastructure/http/DeviceSealedRecovery';
import type { DeviceSealedRootRotation } from '../../../../../contexts/identities/infrastructure/http/DeviceSealedRootRotation';
import type { PigeonDeviceAuthorizationApi } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';
import type { PigeonKeychainApi } from '../../../../../contexts/identities/infrastructure/http/PigeonKeychainApi';
import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DeviceIdentityVaultStore } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVaultStore';

import { DeviceRemovedError } from '../../../../../contexts/identities/domain/DeviceRemovedError';
import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceId } from '../../../../../contexts/identities/domain/value-objects/DeviceId';
import { DeviceUnlockSecretHandle } from '../../../../../contexts/identities/domain/value-objects/DeviceUnlockSecretHandle';
import { PigeonIdentityGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityGateway';
import { PigeonIdentitySessionApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentitySessionApi';
import { DeviceIdentityVault } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVault';
import { copy } from '../../../../../shared/presentation/i18n/copy';

const passthroughRoot = {
  current: (session: Session) => Promise.resolve(session),
} as unknown as DeviceSealedRootRotation;

const passthroughKeychains = {
  migrateLegacyHead: () => Promise.resolve(undefined),
} as unknown as PigeonKeychainApi;

const passthroughRecovery = {
  resumeKeychainRewrap: () => Promise.resolve(undefined),
  resumeRootReseal: () => Promise.resolve(undefined),
} as unknown as DeviceSealedRecovery;

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

// The mocked crypto gives every KeyPair the same public key, so a credential
// that must differ from the genesis one is stood in for by this helper.
function fakeCredential(publicKey: string): KeyPair {
  return {
    toPrimitives: () => ({ privateKey: '', publicKey }),
  } as unknown as KeyPair;
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
      passthroughRoot,
      passthroughKeychains,
      passthroughRecovery,
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
      new PigeonIdentitySessionApi(
        identities,
        vault,
        {
          synchronize: jest.fn(),
        } as unknown as PigeonDeviceAuthorizationApi,
        passthroughRoot,
        passthroughKeychains,
        passthroughRecovery,
      ).unlock(currentIdentity.id, 'password'),
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
      passthroughRoot,
      passthroughKeychains,
      passthroughRecovery,
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
      new PigeonIdentitySessionApi(
        identities,
        vault,
        {
          synchronize: jest.fn(),
        } as unknown as PigeonDeviceAuthorizationApi,
        passthroughRoot,
        passthroughKeychains,
        passthroughRecovery,
      ).unlock(currentIdentity.id, 'wrong password'),
    ).rejects.toThrow(copy.auth.invalidLogin);
  });

  it('unlocks a paired device while the identity document is still at revision 0', async () => {
    const keyPair = await KeyPair.generate();
    const currentIdentity = identity(keyPair.toPrimitives().publicKey);
    const pairedCredential = fakeCredential('paired-device-credential');
    const identities = {
      get: jest.fn().mockResolvedValue(currentIdentity),
    } as unknown as PigeonIdentityGateway;
    const vault = {
      unlock: jest.fn().mockResolvedValue({
        authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
        authorizationRevision: DeviceAuthorizationRevision.fromNumber(1),
        deviceId: DeviceId.generate(),
        material: {
          deviceCredentialKeyPair: pairedCredential,
          identityKeyPair: keyPair,
          recoveryAuthorityKeyPair: await KeyPair.generate(),
          rootKey: { getBuffer: () => SymmetricKey.generate().getBuffer() },
        },
        secretHandle: DeviceUnlockSecretHandle.generate(),
      }),
    } as unknown as DeviceIdentityVault;
    const deviceAuthorization = {
      synchronize: jest
        .fn()
        .mockImplementation((session: Session) => Promise.resolve(session)),
    } as unknown as PigeonDeviceAuthorizationApi;

    await expect(
      new PigeonIdentitySessionApi(
        identities,
        vault,
        deviceAuthorization,
        passthroughRoot,
        passthroughKeychains,
        passthroughRecovery,
      ).unlock(currentIdentity.id, 'password'),
    ).resolves.toMatchObject({ deviceCredentialKeyPair: pairedCredential });
    expect(deviceAuthorization.synchronize).toHaveBeenCalledWith(
      expect.objectContaining({ deviceCredentialKeyPair: pairedCredential }),
    );
  });

  it('reseals a legacy keychain head once the unlocked session holds its root', async () => {
    const keyPair = await KeyPair.generate();
    const currentIdentity = identity(keyPair.toPrimitives().publicKey);
    const root = SymmetricKey.generate();
    const identities = {
      get: jest.fn().mockResolvedValue(currentIdentity),
    } as unknown as PigeonIdentityGateway;
    const vault = {
      unlock: jest.fn().mockResolvedValue({
        authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
        authorizationRevision: DeviceAuthorizationRevision.fromNumber(1),
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
    const deviceAuthorization = {
      synchronize: jest
        .fn()
        .mockImplementation((session: Session) => Promise.resolve(session)),
    } as unknown as PigeonDeviceAuthorizationApi;
    const rootedRoot = {
      current: (session: Session) =>
        Promise.resolve({
          ...session,
          deviceSealedRootKey: root,
        } as unknown as Session),
    } as unknown as DeviceSealedRootRotation;
    const migrateLegacyHead = jest.fn().mockResolvedValue(undefined);
    const keychains = { migrateLegacyHead } as unknown as PigeonKeychainApi;

    await expect(
      new PigeonIdentitySessionApi(
        identities,
        vault,
        deviceAuthorization,
        rootedRoot,
        keychains,
        passthroughRecovery,
      ).unlock(currentIdentity.id, 'password'),
    ).resolves.toMatchObject({ deviceSealedRootKey: root });
    expect(migrateLegacyHead).toHaveBeenCalledTimes(1);
    expect(migrateLegacyHead).toHaveBeenCalledWith(
      expect.objectContaining({ deviceSealedRootKey: root }),
    );
  });

  it('resumes a pending root reseal before the root opens, and a pending keychain rewrap after it', async () => {
    const keyPair = await KeyPair.generate();
    const currentIdentity = identity(keyPair.toPrimitives().publicKey);
    const root = SymmetricKey.generate();
    const identities = {
      get: jest.fn().mockResolvedValue(currentIdentity),
    } as unknown as PigeonIdentityGateway;
    const vault = {
      unlock: jest.fn().mockResolvedValue({
        authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
        authorizationRevision: DeviceAuthorizationRevision.fromNumber(1),
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
    const deviceAuthorization = {
      synchronize: jest
        .fn()
        .mockImplementation((session: Session) => Promise.resolve(session)),
    } as unknown as PigeonDeviceAuthorizationApi;
    const steps: string[] = [];
    const rootedRoot = {
      current: (session: Session) => {
        steps.push('openRoot');
        return Promise.resolve({
          ...session,
          deviceSealedRootKey: root,
        } as unknown as Session);
      },
    } as unknown as DeviceSealedRootRotation;
    const keychains = {
      migrateLegacyHead: jest.fn(() => {
        steps.push('migrateLegacyHead');
        return Promise.resolve(undefined);
      }),
    } as unknown as PigeonKeychainApi;
    const recovery = {
      resumeRootReseal: jest.fn(() => {
        steps.push('resumeRootReseal');
        return Promise.resolve();
      }),
      resumeKeychainRewrap: jest.fn(() => {
        steps.push('resumeKeychainRewrap');
        return Promise.resolve();
      }),
    } as unknown as DeviceSealedRecovery;

    await new PigeonIdentitySessionApi(
      identities,
      vault,
      deviceAuthorization,
      rootedRoot,
      keychains,
      recovery,
    ).unlock(currentIdentity.id, 'password');

    expect(steps).toEqual([
      'resumeRootReseal',
      'openRoot',
      'resumeKeychainRewrap',
      'migrateLegacyHead',
    ]);
    expect(recovery.resumeKeychainRewrap).toHaveBeenCalledWith(
      expect.objectContaining({ deviceSealedRootKey: root }),
    );
  });

  it('unlocks even when the legacy keychain head migration fails', async () => {
    const keyPair = await KeyPair.generate();
    const currentIdentity = identity(keyPair.toPrimitives().publicKey);
    const root = SymmetricKey.generate();
    const identities = {
      get: jest.fn().mockResolvedValue(currentIdentity),
    } as unknown as PigeonIdentityGateway;
    const vault = {
      unlock: jest.fn().mockResolvedValue({
        authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
        authorizationRevision: DeviceAuthorizationRevision.fromNumber(1),
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
    const deviceAuthorization = {
      synchronize: jest
        .fn()
        .mockImplementation((session: Session) => Promise.resolve(session)),
    } as unknown as PigeonDeviceAuthorizationApi;
    const rootedRoot = {
      current: (session: Session) =>
        Promise.resolve({
          ...session,
          deviceSealedRootKey: root,
        } as unknown as Session),
    } as unknown as DeviceSealedRootRotation;
    const migrateLegacyHead = jest
      .fn()
      .mockRejectedValue(new Error('head unreadable'));
    const keychains = { migrateLegacyHead } as unknown as PigeonKeychainApi;

    await expect(
      new PigeonIdentitySessionApi(
        identities,
        vault,
        deviceAuthorization,
        rootedRoot,
        keychains,
        passthroughRecovery,
      ).unlock(currentIdentity.id, 'password'),
    ).resolves.toMatchObject({ deviceSealedRootKey: root });
    expect(migrateLegacyHead).toHaveBeenCalledTimes(1);
  });

  it('refuses a non-genesis device that has not observed a chain revision', async () => {
    const keyPair = await KeyPair.generate();
    const currentIdentity = identity(keyPair.toPrimitives().publicKey);
    const identities = {
      get: jest.fn().mockResolvedValue(currentIdentity),
    } as unknown as PigeonIdentityGateway;
    const vault = {
      unlock: jest.fn().mockResolvedValue({
        authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
        authorizationRevision: DeviceAuthorizationRevision.initial(),
        deviceId: DeviceId.generate(),
        material: {
          deviceCredentialKeyPair: fakeCredential('stranger-device-credential'),
          identityKeyPair: keyPair,
          recoveryAuthorityKeyPair: await KeyPair.generate(),
          rootKey: { getBuffer: () => SymmetricKey.generate().getBuffer() },
        },
        secretHandle: DeviceUnlockSecretHandle.generate(),
      }),
    } as unknown as DeviceIdentityVault;
    const synchronize = jest.fn();

    await expect(
      new PigeonIdentitySessionApi(
        identities,
        vault,
        {
          synchronize,
        } as unknown as PigeonDeviceAuthorizationApi,
        passthroughRoot,
        passthroughKeychains,
        passthroughRecovery,
      ).unlock(currentIdentity.id, 'password'),
    ).rejects.toThrow(copy.auth.invalidLogin);
    expect(synchronize).not.toHaveBeenCalled();
  });

  it('surfaces a device the node removed instead of reporting a wrong password', async () => {
    const keyPair = await KeyPair.generate();
    const currentIdentity = identity(keyPair.toPrimitives().publicKey);
    const deviceCredentialKeyPair = await KeyPair.generate();
    currentIdentity.deviceCredential =
      deviceCredentialKeyPair.toPrimitives().publicKey;
    currentIdentity.deviceCredentialCommitment = SHA256Hash.from(
      new StringValueObject(currentIdentity.deviceCredential),
    ).valueOf();
    const recoveryAuthorityKeyPair = await KeyPair.generate();
    currentIdentity.recoveryAuthority =
      recoveryAuthorityKeyPair.toPrimitives().publicKey;
    const identities = {
      get: jest.fn().mockResolvedValue(currentIdentity),
    } as unknown as PigeonIdentityGateway;
    const vault = {
      unlock: jest.fn().mockResolvedValue({
        authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
        authorizationRevision: DeviceAuthorizationRevision.initial(),
        deviceId: DeviceId.generate(),
        material: {
          deviceCredentialKeyPair,
          identityKeyPair: keyPair,
          recoveryAuthorityKeyPair,
          rootKey: { getBuffer: () => SymmetricKey.generate().getBuffer() },
        },
        secretHandle: DeviceUnlockSecretHandle.generate(),
      }),
    } as unknown as DeviceIdentityVault;
    const deviceAuthorization = {
      synchronize: jest.fn().mockRejectedValue(new DeviceRemovedError()),
    } as unknown as PigeonDeviceAuthorizationApi;
    const unlock = new PigeonIdentitySessionApi(
      identities,
      vault,
      deviceAuthorization,
      passthroughRoot,
      passthroughKeychains,
      passthroughRecovery,
    ).unlock(currentIdentity.id, 'password');

    await expect(unlock).rejects.toBeInstanceOf(DeviceRemovedError);
    await expect(unlock).rejects.not.toThrow(copy.auth.invalidLogin);
  });
});
