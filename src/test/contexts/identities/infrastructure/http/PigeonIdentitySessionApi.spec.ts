import { KeyPair, SHA256Hash, SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';
import { mock } from 'jest-mock-extended';

import type { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';
import type { PigeonDeviceAuthorizationApi } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';
import type { PigeonDeviceSealedSecretApi } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceSealedSecretApi';
import type { PigeonKeychainApi } from '../../../../../contexts/identities/infrastructure/http/PigeonKeychainApi';
import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DeviceIdentityVaultSession } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVaultSession';
import type { DeviceIdentityVaultStore } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVaultStore';

import { DeviceRemovedError } from '../../../../../contexts/identities/domain/DeviceRemovedError';
import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceId } from '../../../../../contexts/identities/domain/value-objects/DeviceId';
import { DeviceUnlockSecretHandle } from '../../../../../contexts/identities/domain/value-objects/DeviceUnlockSecretHandle';
import { DeviceSealedRecovery } from '../../../../../contexts/identities/infrastructure/http/DeviceSealedRecovery';
import { DeviceSealedRootRotation } from '../../../../../contexts/identities/infrastructure/http/DeviceSealedRootRotation';
import { PigeonIdentityGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityGateway';
import { PigeonIdentitySessionApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentitySessionApi';
import { DeviceIdentityVault } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVault';
import { DeviceSealedRecoveryStore } from '../../../../../contexts/identities/infrastructure/storage/DeviceSealedRecoveryStore';
import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../../shared/infrastructure/encoding/base64url';
import { copy } from '../../../../../shared/presentation/i18n/copy';

const passthroughRoot = {
  current: (session: Session) =>
    Promise.resolve({
      ...session,
      deviceSealedRootKey: SymmetricKey.generate(),
    }),
} as unknown as DeviceSealedRootRotation;

const passthroughRecovery = {
  resumeKeychainRewrap: () => Promise.resolve(undefined),
  resumeRootReseal: () => Promise.resolve(undefined),
  rewrapHandedOverKeychain: () => Promise.resolve(undefined),
  rotateLaggingRoot: (session: Session) => Promise.resolve(session),
} as unknown as DeviceSealedRecovery;

function memoryStorage(): Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> {
  const entries = new Map<string, string>();

  return {
    getItem: (key) => entries.get(key) ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

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

async function unlockableDevice(
  deviceSealedRoot: DeviceSealedRootRotation,
  recovery: DeviceSealedRecovery,
): Promise<{ identityId: string; sessionApi: PigeonIdentitySessionApi }> {
  const keyPair = await KeyPair.generate();
  const currentIdentity = identity(keyPair.toPrimitives().publicKey);
  const deviceCredentialKeyPair = await KeyPair.generate();
  const recoveryAuthorityKeyPair = await KeyPair.generate();
  currentIdentity.deviceCredential =
    deviceCredentialKeyPair.toPrimitives().publicKey;
  currentIdentity.deviceCredentialCommitment = SHA256Hash.from(
    new StringValueObject(currentIdentity.deviceCredential),
  ).valueOf();
  currentIdentity.recoveryAuthority =
    recoveryAuthorityKeyPair.toPrimitives().publicKey;
  const identities = mock<PigeonIdentityGateway>();
  const vault = mock<DeviceIdentityVault>();
  const deviceAuthorization = mock<PigeonDeviceAuthorizationApi>();
  identities.get.mockResolvedValue(currentIdentity);
  vault.unlock.mockResolvedValue({
    authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
    authorizationRevision: DeviceAuthorizationRevision.initial(),
    deviceId: DeviceId.generate(),
    material: {
      deviceCredentialKeyPair,
      identityKeyPair: keyPair,
      recoveryAuthorityKeyPair,
      rootKey: SymmetricKey.generate(),
    },
    secretHandle: DeviceUnlockSecretHandle.generate(),
  } as unknown as DeviceIdentityVaultSession);
  deviceAuthorization.synchronize.mockImplementation((session) =>
    Promise.resolve(session),
  );

  return {
    identityId: currentIdentity.id,
    sessionApi: new PigeonIdentitySessionApi(
      identities,
      vault,
      deviceAuthorization,
      deviceSealedRoot,
      recovery,
    ),
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
      passthroughRoot,
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
        passthroughRecovery,
      ).unlock(currentIdentity.id, 'password'),
    ).resolves.toMatchObject({ deviceCredentialKeyPair: pairedCredential });
    expect(deviceAuthorization.synchronize).toHaveBeenCalledWith(
      expect.objectContaining({ deviceCredentialKeyPair: pairedCredential }),
    );
  });

  it('resumes a pending root reseal before the root opens, and the pending keychain rewraps after it', async () => {
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
    const recovery = {
      resumeKeychainRewrap: jest.fn(() => {
        steps.push('resumeKeychainRewrap');

        return Promise.resolve();
      }),
      resumeRootReseal: jest.fn(() => {
        steps.push('resumeRootReseal');

        return Promise.resolve();
      }),
      rewrapHandedOverKeychain: jest.fn(() => {
        steps.push('rewrapHandedOverKeychain');

        return Promise.resolve();
      }),
    } as unknown as DeviceSealedRecovery;

    await new PigeonIdentitySessionApi(
      identities,
      vault,
      deviceAuthorization,
      rootedRoot,
      recovery,
    ).unlock(currentIdentity.id, 'password');

    expect(steps).toEqual([
      'resumeRootReseal',
      'openRoot',
      'resumeKeychainRewrap',
      'rewrapHandedOverKeychain',
    ]);
    expect(recovery.resumeKeychainRewrap).toHaveBeenCalledWith(
      expect.objectContaining({ deviceSealedRootKey: root }),
    );
    expect(recovery.rewrapHandedOverKeychain).toHaveBeenCalledWith(
      expect.objectContaining({ deviceSealedRootKey: root }),
    );
  });

  it('mints a fresh root and rewraps the keychain when its own entry lags the head after another device forgot itself', async () => {
    const keyPair = await KeyPair.generate();
    const currentIdentity = identity(keyPair.toPrimitives().publicKey);
    const laggingRoot = SymmetricKey.generate();
    const head = {
      keychain: { conversations: {}, version: 3 },
      keychainExternalIdentifier: 'kc-3',
    };
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
    // The forgotten device revoked itself at revision 2 and published nothing,
    // so this device's entry still carries the revision-1 root.
    const deviceAuthorization = mock<PigeonDeviceAuthorizationApi>();
    const recipients = [
      fakeCredential('remaining-device'),
    ] as unknown as DeviceCredential[];
    deviceAuthorization.synchronize.mockImplementation((session) =>
      Promise.resolve({
        ...session,
        authorizationRevision: DeviceAuthorizationRevision.fromNumber(2),
      }),
    );
    deviceAuthorization.findDevices.mockResolvedValue(recipients);
    const sealedSecrets = mock<PigeonDeviceSealedSecretApi>();
    sealedSecrets.fetchOwn.mockResolvedValue({
      authorizationRevision: 1,
      generation: 5,
      payload: encodeBase64Url(laggingRoot.getBuffer()),
    });
    sealedSecrets.publish.mockResolvedValue(undefined);
    const keychains = mock<PigeonKeychainApi>();
    keychains.readHead.mockResolvedValue(head);
    keychains.rewrapHead.mockResolvedValue(undefined);
    const store = new DeviceSealedRecoveryStore(memoryStorage());
    const deviceSealedRoot = new DeviceSealedRootRotation(
      deviceAuthorization,
      sealedSecrets,
      keychains,
      () => 0,
    );

    const rooted = await new PigeonIdentitySessionApi(
      identities,
      vault,
      deviceAuthorization,
      deviceSealedRoot,
      new DeviceSealedRecovery(deviceSealedRoot, keychains, store),
    ).unlock(currentIdentity.id, 'password');

    expect(keychains.readHead).toHaveBeenCalledWith(
      expect.objectContaining({ deviceSealedRootKey: laggingRoot }),
    );
    expect(sealedSecrets.publish).toHaveBeenCalledTimes(1);

    const [publishedBy, publication] = sealedSecrets.publish.mock.calls[0];

    expect(publishedBy.authorizationRevision.valueOf()).toBe(2);
    expect(publication.generation).toBe(6);
    expect(publication.recipients).toEqual(recipients);
    expect(publication.payload).not.toBe(
      encodeBase64Url(laggingRoot.getBuffer()),
    );
    expect(rooted.deviceSealedRootKey?.getBuffer()).toEqual(
      decodeBase64Url(publication.payload),
    );
    expect(keychains.rewrapHead).toHaveBeenCalledWith(rooted, head);
    expect(store.read(currentIdentity.id)).toEqual({});
  });

  it('opens the root another device handed over when it forgot itself and moves the keychain head from the root it replaced', async () => {
    const keyPair = await KeyPair.generate();
    const currentIdentity = identity(keyPair.toPrimitives().publicKey);
    const handedOverRoot = SymmetricKey.generate();
    const replacedRoot = SymmetricKey.generate();
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
    // The forgotten device revoked itself at revision 2 and, in the same
    // transition, handed this device a fresh root carrying the replaced one.
    const deviceAuthorization = mock<PigeonDeviceAuthorizationApi>();
    deviceAuthorization.synchronize.mockImplementation((session) =>
      Promise.resolve({
        ...session,
        authorizationRevision: DeviceAuthorizationRevision.fromNumber(2),
      }),
    );
    const sealedSecrets = mock<PigeonDeviceSealedSecretApi>();
    sealedSecrets.fetchOwn.mockResolvedValue({
      authorizationRevision: 2,
      generation: 6,
      payload: `${encodeBase64Url(handedOverRoot.getBuffer())}.${encodeBase64Url(replacedRoot.getBuffer())}`,
    });
    const keychains = mock<PigeonKeychainApi>();
    keychains.rewrapHeadSealedUnder.mockResolvedValue(undefined);
    const deviceSealedRoot = new DeviceSealedRootRotation(
      deviceAuthorization,
      sealedSecrets,
      keychains,
      () => 0,
    );

    const rooted = await new PigeonIdentitySessionApi(
      identities,
      vault,
      deviceAuthorization,
      deviceSealedRoot,
      new DeviceSealedRecovery(
        deviceSealedRoot,
        keychains,
        new DeviceSealedRecoveryStore(memoryStorage()),
      ),
    ).unlock(currentIdentity.id, 'password');

    expect(sealedSecrets.publish).not.toHaveBeenCalled();
    expect(rooted.deviceSealedRootKey?.getBuffer()).toEqual(
      handedOverRoot.getBuffer(),
    );
    expect(rooted.previousDeviceSealedRootKey?.getBuffer()).toEqual(
      replacedRoot.getBuffer(),
    );
    expect(keychains.rewrapHeadSealedUnder).toHaveBeenCalledWith(
      rooted,
      rooted.previousDeviceSealedRootKey,
    );
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
      synchronize: jest
        .fn()
        .mockRejectedValue(new DeviceRemovedError(currentIdentity.id)),
    } as unknown as PigeonDeviceAuthorizationApi;
    const unlock = new PigeonIdentitySessionApi(
      identities,
      vault,
      deviceAuthorization,
      passthroughRoot,
      passthroughRecovery,
    ).unlock(currentIdentity.id, 'password');

    await expect(unlock).rejects.toBeInstanceOf(DeviceRemovedError);
    await expect(unlock).rejects.not.toThrow(copy.auth.invalidLogin);
  });

  it('refuses the unlock when the device sealed root cannot be opened', async () => {
    const deviceSealedRoot = mock<DeviceSealedRootRotation>();
    const recovery = mock<DeviceSealedRecovery>();
    deviceSealedRoot.current.mockRejectedValue(new Error('offline'));
    const { identityId, sessionApi } = await unlockableDevice(
      deviceSealedRoot,
      recovery,
    );

    await expect(sessionApi.unlock(identityId, 'password')).rejects.toThrow(
      copy.auth.deviceRootUnavailable,
    );
    expect(recovery.resumeKeychainRewrap).not.toHaveBeenCalled();
  });

  it('refuses the unlock when no root opens, even after rotating a lagging entry', async () => {
    const deviceSealedRoot = mock<DeviceSealedRootRotation>();
    const recovery = mock<DeviceSealedRecovery>();
    deviceSealedRoot.current.mockImplementation((session) =>
      Promise.resolve(session),
    );
    recovery.rotateLaggingRoot.mockImplementation((session) =>
      Promise.resolve(session),
    );
    const { identityId, sessionApi } = await unlockableDevice(
      deviceSealedRoot,
      recovery,
    );

    await expect(sessionApi.unlock(identityId, 'password')).rejects.toThrow(
      copy.auth.deviceRootUnavailable,
    );
    expect(recovery.rotateLaggingRoot).toHaveBeenCalled();
    expect(recovery.resumeKeychainRewrap).not.toHaveBeenCalled();
  });
});
