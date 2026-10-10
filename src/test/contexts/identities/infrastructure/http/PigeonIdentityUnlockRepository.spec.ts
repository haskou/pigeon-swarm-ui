import { mock } from 'jest-mock-extended';

import type { PigeonIdentitiesGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { DeviceIdentityVault } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVault';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityMasterKeyProtection } from '../../../../../contexts/identities/domain/value-objects/IdentityMasterKeyProtection';
import { IdentityAccessContexts } from '../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { IdentityMapper } from '../../../../../contexts/identities/infrastructure/http/IdentityMapper';
import { PigeonIdentityUnlockRepository } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityUnlockRepository';
import { identityResource } from './identityResource';

describe(PigeonIdentityUnlockRepository.name, () => {
  it('registers the unlocked session and returns the identity aggregate', async () => {
    const gateway = mock<PigeonIdentitiesGateway>();
    const contexts = new IdentityAccessContexts();
    const session = {
      identity: identityResource(),
    } as unknown as Session;

    gateway.unlockSession.mockResolvedValue(session);

    const identity = await new PigeonIdentityUnlockRepository(
      gateway,
      contexts,
      new IdentityMapper(),
      mock<DeviceIdentityVault>(),
    ).unlock(
      IdentityId.fromString('identity-a'),
      IdentityMasterKeyProtection.fromPrimitives({
        password: 'Correct-Horse-Battery-9!',
      }),
    );

    expect(identity.belongsTo(IdentityId.fromString('identity-a'))).toBe(true);
    expect(contexts.find(IdentityId.fromString('identity-a')).session).toBe(
      session,
    );
  });

  it('forgets the device unlock record of the identity', async () => {
    const vault = mock<DeviceIdentityVault>();

    vault.delete.mockResolvedValue(undefined);

    await new PigeonIdentityUnlockRepository(
      mock<PigeonIdentitiesGateway>(),
      new IdentityAccessContexts(),
      new IdentityMapper(),
      vault,
    ).forget(IdentityId.fromString('identity-a'));

    expect(vault.delete).toHaveBeenCalledWith(
      IdentityId.fromString('identity-a'),
    );
  });
});
