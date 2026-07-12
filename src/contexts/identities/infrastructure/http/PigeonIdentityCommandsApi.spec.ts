import { KeyPair, SymmetricKey } from '@haskou/value-objects';

import type {
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';

import { IdentitySignaturePayloadFactory } from '../../domain/IdentitySignaturePayloadFactory';
import { PigeonIdentityKeyProtectionGateway } from '../crypto/PigeonIdentityKeyProtectionGateway';
import { PigeonIdentityCommandsApi } from './PigeonIdentityCommandsApi';
import { PigeonIdentityGateway } from './PigeonIdentityGateway';

function identity(overrides: Partial<IdentityResource> = {}): IdentityResource {
  return {
    encryptedKeyPair: {
      encryptedPrivateKey: 'encrypted-private-key',
      publicKey: 'public-key',
    },
    encryptedMasterKey: 'encrypted-master-key',
    id: 'public-key',
    masterKeyDerivation: {
      algorithm: 'scrypt',
      N: 2 ** 18,
      p: 1,
      r: 8,
      salt: 'salt',
      version: 1,
    },
    networks: ['network-1'],
    profile: { name: 'Ada' },
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
    const keyProtection = {
      protectNewIdentity: jest.fn().mockResolvedValue({
        encryptedKeyPair: {
          encryptedPrivateKey: 'encrypted-private-key',
          publicKey: expect.any(String),
        },
        encryptedMasterKey: 'encrypted-master-key',
        masterKeyDerivation: createdIdentity.masterKeyDerivation,
      }),
    } as unknown as PigeonIdentityKeyProtectionGateway;
    const commands = new PigeonIdentityCommandsApi(
      http,
      signer,
      new PigeonIdentityGateway(http),
      new IdentitySignaturePayloadFactory(),
      keyProtection,
    );

    await expect(
      commands.create('Ada', 'password', ['network-1'], '@ada'),
    ).resolves.toEqual({
      identity: createdIdentity,
      keyPair: expect.any(KeyPair),
      masterKey: expect.any(SymmetricKey),
    });

    expect(http.request).toHaveBeenCalledWith(
      '/identities/',
      expect.objectContaining({ method: 'POST' }),
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
    const keyProtection = {
      protectProfileMasterKey: jest.fn().mockResolvedValue(undefined),
    } as unknown as PigeonIdentityKeyProtectionGateway;
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
      keyProtection,
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
