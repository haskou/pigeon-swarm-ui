import { Timestamp } from '@haskou/value-objects';
import { mock } from 'jest-mock-extended';

import type { PigeonPresenceGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonPresenceGateway';
import type { IdentityPresenceResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { IdentityPresence } from '../../../../../contexts/identities/domain/IdentityPresence';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityPresenceStatus } from '../../../../../contexts/identities/domain/value-objects/IdentityPresenceStatus';
import { IdentityAccessContexts } from '../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { IdentityPresenceMapper } from '../../../../../contexts/identities/infrastructure/http/IdentityPresenceMapper';
import { PigeonPresenceRepository } from '../../../../../contexts/identities/infrastructure/http/PigeonPresenceRepository';

const resource: IdentityPresenceResource = {
  identityId: 'identity-a',
  networkIds: [],
  status: 'available',
  updatedAt: 100,
};

describe(PigeonPresenceRepository.name, () => {
  it('uses the registered session to find and update presence', async () => {
    const gateway = mock<PigeonPresenceGateway>();
    const contexts = new IdentityAccessContexts();
    const repository = new PigeonPresenceRepository(
      gateway,
      contexts,
      new IdentityPresenceMapper(),
    );
    const session = {
      identity: { id: 'actor-a' },
    } as unknown as Session;
    const presence = IdentityPresence.fromPrimitives({
      identityId: 'identity-a',
      lastActivityAt: undefined,
      lastHeartbeatAt: undefined,
      networkIds: [],
      status: 'available',
      updatedAt: 100,
    });

    contexts.register(session);
    gateway.get.mockResolvedValue(resource);
    gateway.update.mockResolvedValue({ ...resource, status: 'away' });

    await repository.find(
      IdentityId.fromString('identity-a'),
      IdentityId.fromString('actor-a'),
    );
    presence.update(IdentityPresenceStatus.AWAY, new Timestamp(200));
    await repository.update(presence, IdentityId.fromString('actor-a'));

    expect(gateway.get).toHaveBeenCalledWith(session, 'identity-a');
    expect(gateway.update).toHaveBeenCalledWith(session, 'away');
  });
});
