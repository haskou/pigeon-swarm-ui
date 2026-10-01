import { KeyPair, SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { DeviceIdentityVault } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVault';
import type {
  IdentityResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceId } from '../../../../../contexts/identities/domain/value-objects/DeviceId';
import { DeviceUnlockSecretHandle } from '../../../../../contexts/identities/domain/value-objects/DeviceUnlockSecretHandle';
import { RecoveryKey } from '../../../../../contexts/identities/domain/value-objects/RecoveryKey';
import { IdentitySignaturePayloadFactory } from '../../../../../contexts/identities/infrastructure/http/IdentitySignaturePayloadFactory';
import { PigeonIdentityCommandsApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityCommandsApi';
import { PigeonIdentityGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityGateway';

function identity(overrides: Partial<IdentityResource> = {}): IdentityResource {
  return {
    authorizationRevision: 0,
    deviceCredential: 'device-credential',
    deviceCredentialCommitment: 'device-credential-commitment',
    id: 'public-key',
    networks: ['network-1'],
    profile: { name: 'Ada' },
    recoveryAuthority: 'recovery-authority',
    signature: 'signature',
    timestamp: 1,
    version: 1,
    ...overrides,
  };
}

describe(PigeonIdentityCommandsApi.name, () => {
  it('creates and signs identity material through the identity boundary', async () => {
    const createdIdentity = identity();
    const http = {
      request: jest.fn().mockResolvedValue(createdIdentity),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
    } as unknown as RequestSigner;
    const vault = {
      delete: jest.fn(),
      register: jest.fn().mockImplementation(({ material }) =>
        Promise.resolve({
          authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
          authorizationRevision: DeviceAuthorizationRevision.initial(),
          deviceId: DeviceId.generate(),
          material,
          secretHandle: DeviceUnlockSecretHandle.generate(),
        }),
      ),
    } as unknown as DeviceIdentityVault;
    const commands = new PigeonIdentityCommandsApi(
      http,
      signer,
      new PigeonIdentityGateway(http),
      new IdentitySignaturePayloadFactory(),
      vault,
    );

    await expect(
      commands.create('Ada', 'password', ['network-1'], '@ada', {
        recoveryKey: RecoveryKey.generate().valueOf(),
      }),
    ).resolves.toMatchObject({
      authorizationEpoch: expect.any(Object),
      authorizationRevision: expect.any(Object),
      deviceCredentialKeyPair: expect.any(KeyPair),
      deviceId: expect.any(Object),
      identity: createdIdentity,
      keyPair: expect.any(KeyPair),
      masterKey: expect.any(SymmetricKey),
      recoveryAuthorityKeyPair: expect.any(KeyPair),
    });

    expect(http.request).toHaveBeenCalledWith(
      '/identities/',
      expect.objectContaining({
        body: expect.not.stringContaining('encryptedMasterKey'),
        method: 'POST',
      }),
    );
    expect(signer.headers).toHaveBeenCalledWith(
      expect.objectContaining({ keyPair: expect.any(KeyPair) }),
      'POST',
      '/identities/',
      expect.any(Object),
    );
  });

  it('refreshes, signs, and caches profile updates at the identity boundary', async () => {
    const currentIdentity = identity({
      identityExternalIdentifier: 'identity-cid',
    });
    const updatedIdentity = identity({
      identityExternalIdentifier: 'updated-identity-cid',
      profile: { name: 'Ada Next' },
      version: 2,
    });
    const http = {
      request: jest.fn().mockResolvedValueOnce(updatedIdentity),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
    } as unknown as RequestSigner;
    const identities = {
      get: jest.fn().mockResolvedValue(currentIdentity),
      remember: jest.fn(),
    } as unknown as PigeonIdentityGateway;
    const vault = {} as DeviceIdentityVault;
    const keyPair = await KeyPair.generate();
    const session = {
      identity: currentIdentity,
      keychain: { conversations: {}, version: 0 },
      keyPair,
      masterKey: SymmetricKey.generate(),
    } as Session;
    const commands = new PigeonIdentityCommandsApi(
      http,
      signer,
      identities,
      new IdentitySignaturePayloadFactory(),
      vault,
    );

    await expect(
      commands.updateProfile(session, { name: 'Ada Next' }, undefined, {}),
    ).resolves.toBe(updatedIdentity);

    expect(http.request).toHaveBeenCalledWith(
      '/identities/public-key',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(identities.remember).toHaveBeenCalledWith(updatedIdentity);
  });
});
