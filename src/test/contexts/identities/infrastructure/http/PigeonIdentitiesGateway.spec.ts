import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';
import type { DevicePairingCode } from '../../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import type { DevicePairingAuthorization } from '../../../../../contexts/identities/infrastructure/http/DevicePairingAuthorization';
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
    Pick<PigeonDeviceAuthorizationApi, 'authorizePairing' | 'revokeDevice'>
  >;
  gateway: PigeonIdentitiesGateway;
  profile: jest.Mocked<Pick<IdentityProfileGateway, 'get'>>;
  keychain: jest.Mocked<
    Pick<PigeonKeychainApi, 'publishKeychain' | 'readHead' | 'rewrapHead'>
  >;
  sealedRoot: jest.Mocked<Pick<DeviceSealedRootRotation, 'reseal' | 'rotate'>>;
} {
  const commands = {} as PigeonIdentityCommandsApi;
  const login = {} as PigeonIdentityLoginApi;
  const profile = {
    get: jest.fn(),
  } as jest.Mocked<Pick<IdentityProfileGateway, 'get'>>;
  const keychain = {
    publishKeychain: jest.fn(),
    readHead: jest.fn(),
    rewrapHead: jest.fn(),
  } as jest.Mocked<
    Pick<PigeonKeychainApi, 'publishKeychain' | 'readHead' | 'rewrapHead'>
  >;
  const authorization = {
    authorizePairing: jest.fn(),
    revokeDevice: jest.fn(),
  } as jest.Mocked<
    Pick<PigeonDeviceAuthorizationApi, 'authorizePairing' | 'revokeDevice'>
  >;
  const sealedRoot = {
    reseal: jest.fn(),
    rotate: jest.fn(),
  } as jest.Mocked<Pick<DeviceSealedRootRotation, 'reseal' | 'rotate'>>;
  const presence = {} as PigeonPresenceGateway;

  return {
    authorization,
    gateway: new PigeonIdentitiesGateway(
      commands,
      login,
      profile as unknown as IdentityProfileGateway,
      authorization as unknown as PigeonDeviceAuthorizationApi,
      keychain as unknown as PigeonKeychainApi,
      presence,
      sealedRoot as unknown as DeviceSealedRootRotation,
    ),
    keychain,
    profile,
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

    it('reseals the authorizer root at the new revision before returning the completion', async () => {
      const { authorization, gateway, sealedRoot } = gatewayDouble();
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

      expect(sealedRoot.reseal).toHaveBeenCalledWith(next, root);
      expect(result.session).toBe(next);
      expect(result.completionCode).toBe('completion-code');
    });

    it('refuses to authorize a device when this session holds no sealed root', async () => {
      const { authorization, gateway, sealedRoot } = gatewayDouble();
      const session = { identity: { id: 'identity-1' } } as unknown as Session;

      await expect(
        gateway.authorizeDevicePairing(session, requestCode),
      ).rejects.toMatchObject({ failure: 'mismatch' });
      expect(authorization.authorizePairing).not.toHaveBeenCalled();
      expect(sealedRoot.reseal).not.toHaveBeenCalled();
    });
  });

  describe('revokeDevice', () => {
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const target = 'device-b' as unknown as DeviceCredential;

    it('reads the head first, then revokes, rotates, and rewraps under the new root', async () => {
      const { authorization, gateway, keychain, sealedRoot } = gatewayDouble();
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
        authorization.revokeDevice.mock.invocationCallOrder[0],
      );
      expect(
        authorization.revokeDevice.mock.invocationCallOrder[0],
      ).toBeLessThan(sealedRoot.rotate.mock.invocationCallOrder[0]);
      expect(sealedRoot.rotate.mock.invocationCallOrder[0]).toBeLessThan(
        keychain.rewrapHead.mock.invocationCallOrder[0],
      );
      expect(sealedRoot.rotate).toHaveBeenCalledWith(revoked);
      expect(keychain.rewrapHead).toHaveBeenCalledWith(rotated, head);
    });

    it('revokes nothing when the head cannot be read', async () => {
      const { authorization, gateway, keychain, sealedRoot } = gatewayDouble();
      keychain.readHead.mockRejectedValue(new Error('head unreadable'));

      await expect(gateway.revokeDevice(session, target)).rejects.toThrow(
        'head unreadable',
      );
      expect(authorization.revokeDevice).not.toHaveBeenCalled();
      expect(sealedRoot.rotate).not.toHaveBeenCalled();
    });

    it('rotates without a rewrap when the identity has no keychain yet', async () => {
      const { authorization, gateway, keychain, sealedRoot } = gatewayDouble();
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
      expect(keychain.rewrapHead).not.toHaveBeenCalled();
    });
  });
});
