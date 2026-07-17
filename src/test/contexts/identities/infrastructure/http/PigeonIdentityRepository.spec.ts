import { KeyPair, SymmetricKey, Timestamp } from '@haskou/value-objects';
import { mock } from 'jest-mock-extended';

import type { PigeonIdentityKeyProtectionGateway } from '../../../../../contexts/identities/infrastructure/crypto/PigeonIdentityKeyProtectionGateway';
import type { PigeonIdentitiesGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { Identity } from '../../../../../contexts/identities/domain/Identity';
import { IdentityProfile } from '../../../../../contexts/identities/domain/profile/IdentityProfile';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityMasterKeyProtection } from '../../../../../contexts/identities/domain/value-objects/IdentityMasterKeyProtection';
import { IdentityNetworkMemberships } from '../../../../../contexts/identities/domain/value-objects/IdentityNetworkMemberships';
import { IdentityCreationMaterials } from '../../../../../contexts/identities/infrastructure/crypto/IdentityCreationMaterials';
import { IdentityAccessContexts } from '../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { IdentityMapper } from '../../../../../contexts/identities/infrastructure/http/IdentityMapper';
import { PigeonIdentityRepository } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityRepository';

function resource(name = 'Ada'): IdentityResource {
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

describe(PigeonIdentityRepository.name, () => {
  it('persists a new aggregate with its generated key material', async () => {
    const gateway = mock<PigeonIdentitiesGateway>();
    const contexts = new IdentityAccessContexts();
    const materials = new IdentityCreationMaterials();
    const keyProtection = mock<PigeonIdentityKeyProtectionGateway>();
    const keyPair = await KeyPair.generate();
    const identityId = IdentityId.fromString(keyPair.toPrimitives().publicKey);
    const masterKey = SymmetricKey.generate();
    const identity = Identity.create(
      identityId,
      IdentityProfile.fromPrimitives({
        banner: undefined,
        biography: undefined,
        handle: 'ada',
        name: 'Ada',
        picture: undefined,
      }),
      IdentityNetworkMemberships.fromPrimitives(['network-a']),
      new Timestamp(100),
    );
    const protection = IdentityMasterKeyProtection.fromPrimitives({
      passkeyPrfEnabled: false,
      password: 'Correct-Horse-Battery-9!',
      recoveryKey: undefined,
    });
    const persistedResource = {
      ...resource(),
      id: identityId.toString(),
    };

    materials.register(identityId, { keyPair, masterKey });
    gateway.createIdentityAggregate.mockResolvedValue({
      identity: persistedResource,
      keyPair,
      masterKey,
    });

    const persisted = await new PigeonIdentityRepository(
      gateway,
      contexts,
      new IdentityMapper(),
      materials,
      keyProtection,
    ).create(identity, protection);

    expect(persisted.belongsTo(identityId)).toBe(true);
    expect(gateway.createIdentityAggregate).toHaveBeenCalledWith(
      identity,
      expect.objectContaining({ keyPair, masterKey }),
      protection,
    );
    expect(contexts.find(identityId).session.identity).toBe(persistedResource);
  });

  it('maps identity reads into aggregates', async () => {
    const gateway = mock<PigeonIdentitiesGateway>();
    const repository = new PigeonIdentityRepository(
      gateway,
      new IdentityAccessContexts(),
      new IdentityMapper(),
      mock<IdentityCreationMaterials>(),
      mock<PigeonIdentityKeyProtectionGateway>(),
    );

    gateway.getIdentity.mockResolvedValue(resource());

    const identity = await repository.find(IdentityId.fromString('identity-a'));

    expect(identity.belongsTo(IdentityId.fromString('identity-a'))).toBe(true);
  });

  it('uses the registered infrastructure access context when persisting', async () => {
    const gateway = mock<PigeonIdentitiesGateway>();
    const contexts = new IdentityAccessContexts();
    const mapper = new IdentityMapper();
    const repository = new PigeonIdentityRepository(
      gateway,
      contexts,
      mapper,
      mock<IdentityCreationMaterials>(),
      mock<PigeonIdentityKeyProtectionGateway>(),
    );
    const session = { identity: resource() } as Session;
    const identity = mapper.fromResource(resource());

    contexts.register(session, 'new-password', { passkeyPrfEnabled: true });
    gateway.updateIdentityProfile.mockResolvedValue(resource('Ada Lovelace'));

    await repository.update(identity, IdentityId.fromString('identity-a'));

    expect(gateway.updateIdentityProfile).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ name: 'Ada' }),
      'new-password',
      { passkeyPrfEnabled: true },
    );
  });
});
