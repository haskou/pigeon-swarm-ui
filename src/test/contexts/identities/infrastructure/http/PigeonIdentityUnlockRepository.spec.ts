import { mock } from 'jest-mock-extended';

import type { PigeonIdentitiesGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
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
    ).unlock(
      IdentityId.fromString('identity-a'),
      IdentityMasterKeyProtection.fromPrimitives({
        passkeyPrfEnabled: false,
        password: 'Correct-Horse-Battery-9!',
        recoveryKey: undefined,
      }),
    );

    expect(identity.belongsTo(IdentityId.fromString('identity-a'))).toBe(true);
    expect(contexts.find(IdentityId.fromString('identity-a')).session).toBe(
      session,
    );
  });
});
