import { KeyPair, SymmetricKey } from '@haskou/value-objects';

import type {
  IdentityResource,
  LoginResult,
} from '../../../../shared/domain/pigeonResources.types';

import { ProfileHandle } from '../../domain/profile/ProfileHandle';
import { ProfileName } from '../../domain/profile/ProfileName';
import { IdentityNetworkMemberships } from '../../domain/value-objects/IdentityNetworkMemberships';
import { PigeonIdentityKeyProtectionGateway } from '../crypto/PigeonIdentityKeyProtectionGateway';
import { PigeonIdentityCommandsApi } from './PigeonIdentityCommandsApi';
import { PigeonIdentityRegistrationApi } from './PigeonIdentityRegistrationApi';
import { PigeonIdentityWorkspaceSessionApi } from './PigeonIdentityWorkspaceSessionApi';

function identity(
  passkeyPrf?: IdentityResource['masterKeyDerivation']['passkeyPrf'],
): IdentityResource {
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
      ...(passkeyPrf ? { passkeyPrf } : {}),
      r: 8,
      salt: 'salt',
      version: 1,
    },
    networks: ['network-1'],
    profile: { name: 'Ada' },
    signature: 'signature',
    timestamp: 1,
    version: 1,
  };
}

describe(PigeonIdentityRegistrationApi.name, () => {
  it('keeps optional local passkey setup non-blocking after registration', async () => {
    const createdIdentity = identity();
    const keyPair = await KeyPair.generate();
    const masterKey = SymmetricKey.generate();
    const result = {
      conversations: [],
      session: { identity: createdIdentity },
    } as unknown as LoginResult;
    const commands = {
      create: jest.fn().mockResolvedValue({
        identity: createdIdentity,
        keyPair,
        masterKey,
      }),
    } as unknown as PigeonIdentityCommandsApi;
    const workspace = {
      hydrate: jest.fn().mockResolvedValue(result),
    } as unknown as PigeonIdentityWorkspaceSessionApi;
    const keyProtection = {
      saveLocalPasskeyMasterKeyUnlock: jest
        .fn()
        .mockRejectedValue(new Error('user cancelled')),
    } as unknown as PigeonIdentityKeyProtectionGateway;
    const registration = new PigeonIdentityRegistrationApi(
      commands,
      workspace,
      keyProtection,
    );

    await expect(
      registration.register(
        ProfileName.fromString('Ada'),
        'password',
        IdentityNetworkMemberships.fromPrimitives(['network-1']),
        ProfileHandle.fromString('ada'),
        { passkeyPrfEnabled: true },
      ),
    ).resolves.toBe(result);

    expect(keyProtection.saveLocalPasskeyMasterKeyUnlock).toHaveBeenCalledWith({
      displayName: 'Ada',
      identityId: 'public-key',
      masterKey,
      password: 'password',
    });
  });

  it('does not create a second local unlock when identity protection has PRF', async () => {
    const createdIdentity = identity({
      algorithm: 'webauthn-prf',
      credentialId: 'credential-id',
      salt: 'passkey-salt',
      version: 1,
    });
    const result = { conversations: [] } as unknown as LoginResult;
    const commands = {
      create: jest.fn().mockResolvedValue({
        identity: createdIdentity,
        keyPair: await KeyPair.generate(),
        masterKey: SymmetricKey.generate(),
      }),
    } as unknown as PigeonIdentityCommandsApi;
    const keyProtection = {
      saveLocalPasskeyMasterKeyUnlock: jest.fn(),
    } as unknown as PigeonIdentityKeyProtectionGateway;
    const registration = new PigeonIdentityRegistrationApi(
      commands,
      {
        hydrate: jest.fn().mockResolvedValue(result),
      } as unknown as PigeonIdentityWorkspaceSessionApi,
      keyProtection,
    );

    await registration.register(
      ProfileName.fromString('Ada'),
      'password',
      IdentityNetworkMemberships.fromPrimitives(['network-1']),
      ProfileHandle.fromString('ada'),
      { passkeyPrfEnabled: true },
    );

    expect(
      keyProtection.saveLocalPasskeyMasterKeyUnlock,
    ).not.toHaveBeenCalled();
  });
});
