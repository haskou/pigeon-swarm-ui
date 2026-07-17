import { Timestamp } from '@haskou/value-objects';

import { DisconnectedIdentityPresenceSelectionError } from '../../../../contexts/identities/domain/errors/DisconnectedIdentityPresenceSelectionError';
import { IdentityPresence } from '../../../../contexts/identities/domain/IdentityPresence';
import { IdentityPresenceStatus } from '../../../../contexts/identities/domain/value-objects/IdentityPresenceStatus';

function presence(): IdentityPresence {
  return IdentityPresence.fromPrimitives({
    identityId: 'identity-a',
    lastActivityAt: undefined,
    lastHeartbeatAt: undefined,
    networkIds: ['network-a'],
    status: 'available',
    updatedAt: 100,
  });
}

describe(IdentityPresence.name, () => {
  it('records a selectable presence transition', () => {
    const aggregate = presence();

    aggregate.update(IdentityPresenceStatus.AWAY, new Timestamp(200));

    expect(aggregate.pullDomainEvents()).toEqual([
      {
        aggregateId: 'identity-a',
        occurredAt: 200,
        type: 'IdentityPresenceUpdated',
      },
    ]);
  });

  it('rejects selecting disconnected presence', () => {
    expect(() =>
      presence().update(
        IdentityPresenceStatus.DISCONNECTED,
        new Timestamp(200),
      ),
    ).toThrow(DisconnectedIdentityPresenceSelectionError);
  });
});
