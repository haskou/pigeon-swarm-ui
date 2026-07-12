import type { PigeonIdentityKeyProtectionGateway } from '../../../../../contexts/identities/infrastructure/crypto/PigeonIdentityKeyProtectionGateway';
import type { PigeonIdentityCommandsApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityCommandsApi';
import type { PigeonIdentityGateway as IdentityProfileGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityGateway';
import type { PigeonIdentityLoginApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityLoginApi';
import type { PigeonIdentityRegistrationApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityRegistrationApi';
import type { PigeonKeychainApi } from '../../../../../contexts/identities/infrastructure/http/PigeonKeychainApi';
import type { PigeonPresenceGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonPresenceGateway';
import type {
  IdentityResource,
  LocalKeychain,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { PigeonIdentitiesGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';

function identity(): IdentityResource {
  return {
    encryptedKeyPair: {
      encryptedPrivateKey: 'encrypted-private-key',
      publicKey: 'public-key',
    },
    encryptedMasterKey: 'encrypted-master-key',
    id: 'identity-1',
    masterKeyDerivation: {
      algorithm: 'scrypt',
      N: 16_384,
      p: 1,
      r: 8,
      salt: 'salt',
      version: 1,
    },
    networks: [],
    profile: { name: 'Identity' },
    signature: 'signature',
    timestamp: 1,
    version: 1,
  };
}

function gatewayDouble(): {
  gateway: PigeonIdentitiesGateway;
  profile: jest.Mocked<Pick<IdentityProfileGateway, 'get'>>;
  keychain: jest.Mocked<Pick<PigeonKeychainApi, 'publishKeychain'>>;
} {
  const commands = {} as PigeonIdentityCommandsApi;
  const login = {} as PigeonIdentityLoginApi;
  const profile = {
    get: jest.fn(),
  } as jest.Mocked<Pick<IdentityProfileGateway, 'get'>>;
  const protection = {} as PigeonIdentityKeyProtectionGateway;
  const keychain = {
    publishKeychain: jest.fn(),
  } as jest.Mocked<Pick<PigeonKeychainApi, 'publishKeychain'>>;
  const presence = {} as PigeonPresenceGateway;
  const registration = {} as PigeonIdentityRegistrationApi;

  return {
    gateway: new PigeonIdentitiesGateway(
      commands,
      login,
      profile as unknown as IdentityProfileGateway,
      protection,
      keychain as unknown as PigeonKeychainApi,
      presence,
      registration,
    ),
    keychain,
    profile,
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
    const published = {
      keychain: nextKeychain,
      keychainExternalIdentifier: 'keychain-1',
    };
    keychain.publishKeychain.mockResolvedValue(published);

    await expect(gateway.publishKeychain(session, nextKeychain)).resolves.toBe(
      published,
    );
    expect(keychain.publishKeychain).toHaveBeenCalledWith(
      session,
      nextKeychain,
    );
  });
});
