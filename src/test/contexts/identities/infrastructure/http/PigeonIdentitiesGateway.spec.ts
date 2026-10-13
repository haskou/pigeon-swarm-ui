import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { DevicePairingRequestDraft } from '../../../../../contexts/identities/domain/DevicePairingRequestDraft';
import type { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';
import type { DevicePairingCode } from '../../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import type { IdentityPassword } from '../../../../../contexts/identities/domain/value-objects/IdentityPassword';
import type { DevicePairingAuthorization } from '../../../../../contexts/identities/infrastructure/http/DevicePairingAuthorization';
import type { DevicePairingHistory } from '../../../../../contexts/identities/infrastructure/http/DevicePairingHistory';
import type { DeviceSealedRecovery } from '../../../../../contexts/identities/infrastructure/http/DeviceSealedRecovery';
import type { DeviceSealedRootRotation } from '../../../../../contexts/identities/infrastructure/http/DeviceSealedRootRotation';
import type { PigeonDeviceAuthorizationApi } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';
import type { PigeonIdentityCommandsApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityCommandsApi';
import type { PigeonIdentityGateway as IdentityProfileGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityGateway';
import type { PigeonIdentityLoginApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityLoginApi';
import type { PigeonKeychainApi } from '../../../../../contexts/identities/infrastructure/http/PigeonKeychainApi';
import type { PigeonPresenceGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonPresenceGateway';
import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { LocalKeychain } from '../../../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { DevicePairingError } from '../../../../../contexts/identities/domain/DevicePairingError';
import { PigeonIdentitiesGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';

function identity(): IdentityResource {
  return {
    admissionNonce: '0',
    authorizationRevision: 0,
    deviceCredential: 'device-credential',
    deviceCredentialCommitment: 'device-credential-commitment',
    id: 'identity-1',
    networks: [],
    profile: { name: 'Identity' },
    recoveryAuthority: 'recovery-authority',
    signature: 'signature',
    timestamp: 1,
    version: 1,
  };
}

function gatewayDouble(): {
  authorization: jest.Mocked<
    Pick<
      PigeonDeviceAuthorizationApi,
      'authorizePairing' | 'completePairing' | 'revokeDevice'
    >
  >;
  gateway: PigeonIdentitiesGateway;
  keychain: jest.Mocked<
    Pick<PigeonKeychainApi, 'publishKeychain' | 'readHead'>
  >;
  login: jest.Mocked<Pick<PigeonIdentityLoginApi, 'hydrate'>>;
  pairingHistory: jest.Mocked<
    Pick<DevicePairingHistory, 'publish' | 'receive'>
  >;
  profile: jest.Mocked<Pick<IdentityProfileGateway, 'get'>>;
  recovery: jest.Mocked<
    Pick<
      DeviceSealedRecovery,
      'rememberKeychainRewrap' | 'rewrapAfterRevoke' | 'resealAfterPairing'
    >
  >;
  sealedRoot: jest.Mocked<Pick<DeviceSealedRootRotation, 'current' | 'rotate'>>;
} {
  const commands = {} as PigeonIdentityCommandsApi;
  const login = {
    hydrate: jest.fn(),
  } as jest.Mocked<Pick<PigeonIdentityLoginApi, 'hydrate'>>;
  const profile = {
    get: jest.fn(),
  } as jest.Mocked<Pick<IdentityProfileGateway, 'get'>>;
  const keychain = {
    publishKeychain: jest.fn(),
    readHead: jest.fn(),
  } as jest.Mocked<Pick<PigeonKeychainApi, 'publishKeychain' | 'readHead'>>;
  const authorization = {
    authorizePairing: jest.fn(),
    completePairing: jest.fn(),
    revokeDevice: jest.fn(),
  } as jest.Mocked<
    Pick<
      PigeonDeviceAuthorizationApi,
      'authorizePairing' | 'completePairing' | 'revokeDevice'
    >
  >;
  const recovery = {
    rememberKeychainRewrap: jest.fn(),
    resealAfterPairing: jest.fn(),
    rewrapAfterRevoke: jest.fn(),
  } as jest.Mocked<
    Pick<
      DeviceSealedRecovery,
      'rememberKeychainRewrap' | 'rewrapAfterRevoke' | 'resealAfterPairing'
    >
  >;
  const sealedRoot = {
    current: jest.fn(),
    rotate: jest.fn(),
  } as jest.Mocked<Pick<DeviceSealedRootRotation, 'current' | 'rotate'>>;
  const pairingHistory = {
    publish: jest.fn().mockResolvedValue(false),
    receive: jest.fn(),
  } as jest.Mocked<Pick<DevicePairingHistory, 'publish' | 'receive'>>;
  const presence = {} as PigeonPresenceGateway;

  return {
    authorization,
    gateway: new PigeonIdentitiesGateway(
      commands,
      login as unknown as PigeonIdentityLoginApi,
      profile as unknown as IdentityProfileGateway,
      authorization as unknown as PigeonDeviceAuthorizationApi,
      keychain as unknown as PigeonKeychainApi,
      presence,
      sealedRoot as unknown as DeviceSealedRootRotation,
      recovery as unknown as DeviceSealedRecovery,
      pairingHistory as unknown as DevicePairingHistory,
    ),
    keychain,
    login,
    pairingHistory,
    profile,
    recovery,
    sealedRoot,
  };
}

describe(PigeonIdentitiesGateway.name, () => {
  it('adapts identity profile reads to the application boundary', async () => {
    const { gateway, profile } = gatewayDouble();
    const result = identity();
    profile.get.mockResolvedValue(result);

    await expect(gateway.getIdentity('identity-1')).resolves.toBe(result);
    expect(profile.get).toHaveBeenCalledWith('identity-1');
  });

  it('publishes keychains through the identity infrastructure adapter', async () => {
    const { gateway, keychain } = gatewayDouble();
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const nextKeychain = { conversations: {}, version: 2 } as LocalKeychain;
    const update = jest.fn().mockReturnValue(nextKeychain);
    const published = {
      keychain: nextKeychain,
      keychainExternalIdentifier: 'keychain-1',
    };
    keychain.publishKeychain.mockResolvedValue(published);

    await expect(gateway.publishKeychain(session, update)).resolves.toBe(
      published,
    );
    expect(keychain.publishKeychain).toHaveBeenCalledWith(session, update);
  });

  describe('authorizeDevicePairing', () => {
    const requestCode = 'request-code' as unknown as DevicePairingCode;

    it('hands the authorizer root reseal to recovery at the new revision before returning the completion', async () => {
      const { authorization, gateway, recovery } = gatewayDouble();
      const root = SymmetricKey.generate();
      const session = {
        deviceSealedRootKey: root,
        identity: { id: 'identity-1' },
      } as unknown as Session;
      const next = {
        ...session,
        authorizationRevision: 2,
      } as unknown as Session;
      authorization.authorizePairing.mockResolvedValue({
        completion: { toCode: () => 'completion-code' },
        session: next,
      } as unknown as DevicePairingAuthorization);

      const result = await gateway.authorizeDevicePairing(session, requestCode);

      expect(
        authorization.authorizePairing.mock.invocationCallOrder[0],
      ).toBeLessThan(recovery.resealAfterPairing.mock.invocationCallOrder[0]);
      expect(recovery.resealAfterPairing).toHaveBeenCalledWith(next, root);
      expect(result.session).toBe(next);
      expect(result.completionCode).toBe('completion-code');
    });

    it('opens the sealed root for a session that holds none before authorizing the pairing', async () => {
      const { authorization, gateway, recovery, sealedRoot } = gatewayDouble();
      const root = SymmetricKey.generate();
      const session = { identity: { id: 'identity-1' } } as unknown as Session;
      const rooted = {
        ...session,
        deviceSealedRootKey: root,
      } as unknown as Session;
      const next = {
        ...rooted,
        authorizationRevision: 2,
      } as unknown as Session;
      sealedRoot.current.mockResolvedValue(rooted);
      authorization.authorizePairing.mockResolvedValue({
        completion: { toCode: () => 'completion-code' },
        session: next,
      } as unknown as DevicePairingAuthorization);

      const result = await gateway.authorizeDevicePairing(session, requestCode);

      expect(sealedRoot.current).toHaveBeenCalledWith(session);
      expect(authorization.authorizePairing).toHaveBeenCalledWith(
        rooted,
        requestCode,
        expect.any(SymmetricKey),
      );
      expect(recovery.resealAfterPairing).toHaveBeenCalledWith(next, root);
      expect(result.completionCode).toBe('completion-code');
    });

    it('refuses to authorize a device when opening the sealed root leaves none open', async () => {
      const { authorization, gateway, recovery, sealedRoot } = gatewayDouble();
      const session = { identity: { id: 'identity-1' } } as unknown as Session;
      sealedRoot.current.mockResolvedValue(session);

      await expect(
        gateway.authorizeDevicePairing(session, requestCode),
      ).rejects.toMatchObject({ failure: 'mismatch' });
      expect(authorization.authorizePairing).not.toHaveBeenCalled();
      expect(recovery.resealAfterPairing).not.toHaveBeenCalled();
    });

    it('authorizes nothing when the sealed root cannot be opened', async () => {
      const { authorization, gateway, recovery, sealedRoot } = gatewayDouble();
      const session = { identity: { id: 'identity-1' } } as unknown as Session;
      const failure = new Error('keychain head is unreadable');
      sealedRoot.current.mockRejectedValue(failure);

      await expect(
        gateway.authorizeDevicePairing(session, requestCode),
      ).rejects.toBe(failure);
      expect(authorization.authorizePairing).not.toHaveBeenCalled();
      expect(recovery.resealAfterPairing).not.toHaveBeenCalled();
    });

    it('publishes the pairing history before authorizing and always hands the secret to the authorizer', async () => {
      const { authorization, gateway, pairingHistory } = gatewayDouble();
      const session = {
        deviceSealedRootKey: SymmetricKey.generate(),
        identity: { id: 'identity-1' },
      } as unknown as Session;
      pairingHistory.publish.mockResolvedValue();
      authorization.authorizePairing.mockResolvedValue({
        completion: { toCode: () => 'completion-code' },
        session,
      } as unknown as DevicePairingAuthorization);

      await gateway.authorizeDevicePairing(session, requestCode);

      expect(pairingHistory.publish).toHaveBeenCalledWith(
        session,
        expect.any(Uint8Array),
      );
      expect(pairingHistory.publish.mock.invocationCallOrder[0]).toBeLessThan(
        authorization.authorizePairing.mock.invocationCallOrder[0],
      );
      const [, , secret] = authorization.authorizePairing.mock.calls[0];
      expect(secret).toBeInstanceOf(SymmetricKey);
      expect(secret?.getBuffer()).toEqual(
        pairingHistory.publish.mock.calls[0][1],
      );
    });
  });

  describe('completeDevicePairing', () => {
    const password = {} as IdentityPassword;
    const draft = {} as DevicePairingRequestDraft;
    const completionCode = 'completion-code' as unknown as DevicePairingCode;

    it('opens the sealed root before hydrating, so a keychain head opens, then imports the history', async () => {
      const {
        authorization,
        gateway,
        login,
        pairingHistory,
        profile,
        sealedRoot,
      } = gatewayDouble();
      const secret = SymmetricKey.generate();
      const pending = { identity: { id: 'identity-1' } } as unknown as Session;
      const rooted = {
        ...pending,
        deviceSealedRootKey: SymmetricKey.generate(),
      } as unknown as Session;
      const hydrated = { ...rooted, hydrated: true } as unknown as Session;
      profile.get.mockResolvedValue(identity());
      authorization.completePairing.mockResolvedValue({
        historyTransferSecret: secret,
        session: pending,
      });
      sealedRoot.current.mockResolvedValue(rooted);
      login.hydrate.mockResolvedValue({ conversations: [], session: hydrated });

      const result = await gateway.completeDevicePairing(
        'identity-1',
        password,
        draft,
        completionCode,
      );

      expect(sealedRoot.current).toHaveBeenCalledWith(pending);
      expect(sealedRoot.current.mock.invocationCallOrder[0]).toBeLessThan(
        login.hydrate.mock.invocationCallOrder[0],
      );
      expect(login.hydrate).toHaveBeenCalledWith(rooted, undefined);
      expect(pairingHistory.receive).toHaveBeenCalledWith(
        hydrated,
        secret.getBuffer(),
      );
      expect(result.session).toBe(hydrated);
    });

    it('refuses the pairing without hydrating when the sealed root cannot be opened', async () => {
      const {
        authorization,
        gateway,
        login,
        pairingHistory,
        profile,
        sealedRoot,
      } = gatewayDouble();
      const pending = { identity: { id: 'identity-1' } } as unknown as Session;
      profile.get.mockResolvedValue(identity());
      authorization.completePairing.mockResolvedValue({
        historyTransferSecret: SymmetricKey.generate(),
        session: pending,
      });
      sealedRoot.current.mockResolvedValue(pending);

      await expect(
        gateway.completeDevicePairing(
          'identity-1',
          password,
          draft,
          completionCode,
        ),
      ).rejects.toThrow(DevicePairingError);
      expect(login.hydrate).not.toHaveBeenCalled();
      expect(pairingHistory.receive).not.toHaveBeenCalled();
    });

    it('refuses the pairing without hydrating when opening the sealed root fails', async () => {
      const { authorization, gateway, login, profile, sealedRoot } =
        gatewayDouble();
      const pending = { identity: { id: 'identity-1' } } as unknown as Session;
      profile.get.mockResolvedValue(identity());
      authorization.completePairing.mockResolvedValue({
        historyTransferSecret: SymmetricKey.generate(),
        session: pending,
      });
      sealedRoot.current.mockRejectedValue(
        new Error('keychain head is unreadable'),
      );

      await expect(
        gateway.completeDevicePairing(
          'identity-1',
          password,
          draft,
          completionCode,
        ),
      ).rejects.toThrow('keychain head is unreadable');
      expect(login.hydrate).not.toHaveBeenCalled();
    });
  });

  describe('revokeDevice', () => {
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const target = 'device-b' as unknown as DeviceCredential;

    it('reads the head, records the previous key, then revokes, rotates, and hands the rewrap to recovery under the new root', async () => {
      const { authorization, gateway, keychain, recovery, sealedRoot } =
        gatewayDouble();
      const head = {
        keychain: { conversations: {}, version: 1 } as LocalKeychain,
        keychainExternalIdentifier: 'kc-1',
      };
      const revoked = {
        ...session,
        authorizationRevision: 3,
      } as unknown as Session;
      const rotated = {
        ...session,
        authorizationRevision: 4,
      } as unknown as Session;
      keychain.readHead.mockResolvedValue(head);
      authorization.revokeDevice.mockResolvedValue(revoked);
      sealedRoot.rotate.mockResolvedValue(rotated);

      await expect(gateway.revokeDevice(session, target)).resolves.toBe(
        rotated,
      );

      expect(keychain.readHead.mock.invocationCallOrder[0]).toBeLessThan(
        recovery.rememberKeychainRewrap.mock.invocationCallOrder[0],
      );
      expect(
        recovery.rememberKeychainRewrap.mock.invocationCallOrder[0],
      ).toBeLessThan(authorization.revokeDevice.mock.invocationCallOrder[0]);
      expect(
        authorization.revokeDevice.mock.invocationCallOrder[0],
      ).toBeLessThan(sealedRoot.rotate.mock.invocationCallOrder[0]);
      expect(sealedRoot.rotate.mock.invocationCallOrder[0]).toBeLessThan(
        recovery.rewrapAfterRevoke.mock.invocationCallOrder[0],
      );
      expect(recovery.rememberKeychainRewrap).toHaveBeenCalledWith(session);
      expect(sealedRoot.rotate).toHaveBeenCalledWith(revoked);
      expect(recovery.rewrapAfterRevoke).toHaveBeenCalledWith(rotated, head);
    });

    it('refuses to revoke when the previous key cannot be recorded for the rewrap', async () => {
      const { authorization, gateway, keychain, recovery, sealedRoot } =
        gatewayDouble();
      keychain.readHead.mockResolvedValue({
        keychain: { conversations: {}, version: 1 } as LocalKeychain,
        keychainExternalIdentifier: 'kc-1',
      });
      recovery.rememberKeychainRewrap.mockImplementation(() => {
        throw new Error('storage full');
      });

      await expect(gateway.revokeDevice(session, target)).rejects.toThrow(
        'storage full',
      );
      expect(authorization.revokeDevice).not.toHaveBeenCalled();
      expect(sealedRoot.rotate).not.toHaveBeenCalled();
    });

    it('revokes nothing when the head cannot be read', async () => {
      const { authorization, gateway, keychain, recovery, sealedRoot } =
        gatewayDouble();
      keychain.readHead.mockRejectedValue(new Error('head unreadable'));

      await expect(gateway.revokeDevice(session, target)).rejects.toThrow(
        'head unreadable',
      );
      expect(recovery.rememberKeychainRewrap).not.toHaveBeenCalled();
      expect(authorization.revokeDevice).not.toHaveBeenCalled();
      expect(sealedRoot.rotate).not.toHaveBeenCalled();
    });

    it('rotates without a rewrap when the identity has no keychain yet', async () => {
      const { authorization, gateway, keychain, recovery, sealedRoot } =
        gatewayDouble();
      const rotated = {
        ...session,
        authorizationRevision: 4,
      } as unknown as Session;
      keychain.readHead.mockResolvedValue(undefined);
      authorization.revokeDevice.mockResolvedValue(session);
      sealedRoot.rotate.mockResolvedValue(rotated);

      await expect(gateway.revokeDevice(session, target)).resolves.toBe(
        rotated,
      );
      expect(recovery.rememberKeychainRewrap).not.toHaveBeenCalled();
      expect(recovery.rewrapAfterRevoke).not.toHaveBeenCalled();
    });
  });
});
