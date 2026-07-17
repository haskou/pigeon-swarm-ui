import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';

export function identityResource(name = 'Ada'): IdentityResource {
  return {
    encryptedKeyPair: {
      encryptedPrivateKey: 'encrypted-private-key',
      publicKey: 'public-key',
    },
    encryptedMasterKey: 'encrypted-master-key',
    id: 'identity-a',
    masterKeyDerivation: {
      algorithm: 'scrypt',
      N: 262_144,
      p: 1,
      r: 8,
      salt: 'salt',
      version: 1,
    },
    networks: ['network-a'],
    profile: { name },
    signature: 'signature',
    timestamp: 100,
    version: 1,
  };
}
