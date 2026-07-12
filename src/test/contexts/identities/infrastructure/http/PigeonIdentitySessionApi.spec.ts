import { KeyPair, SymmetricKey } from '@haskou/value-objects';

import type { IdentityResource } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonIdentityKeyProtectionGateway } from '../../../../../contexts/identities/infrastructure/crypto/PigeonIdentityKeyProtectionGateway';
import { PigeonIdentityGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityGateway';
import { PigeonIdentitySessionApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentitySessionApi';

function identity(id: string): IdentityResource {
  return {
    encryptedKeyPair: {
      encryptedPrivateKey: 'encrypted-private-key',
      publicKey: id,
    },
    encryptedMasterKey: 'encrypted-master-key',
    id,
    masterKeyDerivation: {
      algorithm: 'scrypt',
      N: 2 ** 18,
      p: 1,
      r: 8,
      salt: 'salt',
      version: 1,
    },
    networks: [],
    profile: { name: 'Ada' },
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
    const keyProtection = {
      shouldConfirmPasskey: jest.fn().mockReturnValue(false),
      unlockIdentityKeyPair: jest.fn().mockReturnValue(keyPair),
      unlockLoginMasterKey: jest.fn().mockResolvedValue(masterKey),
    } as unknown as PigeonIdentityKeyProtectionGateway;
    const sessionApi = new PigeonIdentitySessionApi(identities, keyProtection);

    await expect(
      sessionApi.unlock(' @ada ', 'password'),
    ).resolves.toMatchObject({
      identity: currentIdentity,
      keychain: { conversations: {}, version: 0 },
      keyPair,
      masterKey,
    });

    expect(identities.get).toHaveBeenCalledWith('@ada');
    expect(keyProtection.unlockLoginMasterKey).toHaveBeenCalledWith({
      identity: currentIdentity,
      password: 'password',
      recoveryKey: undefined,
    });
  });
});
