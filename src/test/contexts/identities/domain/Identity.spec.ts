import { Timestamp } from '@haskou/value-objects';

import { Identity } from '../../../../contexts/identities/domain/Identity';
import { IdentityProfile } from '../../../../contexts/identities/domain/profile/IdentityProfile';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityNetworkId } from '../../../../contexts/identities/domain/value-objects/IdentityNetworkId';
import { IdentityNetworkMemberships } from '../../../../contexts/identities/domain/value-objects/IdentityNetworkMemberships';

function identity(): Identity {
  return Identity.fromPrimitives({
    createdAt: 100,
    id: 'identity-a',
    networkIds: ['network-a'],
    profile: {
      banner: undefined,
      biography: undefined,
      handle: undefined,
      name: 'Ada',
      picture: undefined,
    },
  });
}

describe(Identity.name, () => {
  it('answers network membership without exposing its collection', () => {
    expect(
      identity().belongsToNetwork(IdentityNetworkId.fromString('network-a')),
    ).toBe(true);
  });

  it('records creation as an aggregate event', () => {
    const created = Identity.create(
      IdentityId.fromString('identity-a'),
      IdentityProfile.fromPrimitives({
        banner: undefined,
        biography: undefined,
        handle: undefined,
        name: 'Ada',
        picture: undefined,
      }),
      IdentityNetworkMemberships.fromPrimitives(['network-a']),
      new Timestamp(100),
    );

    expect(created.pullDomainEvents()).toEqual([
      {
        aggregateId: 'identity-a',
        occurredAt: 100,
        type: 'IdentityCreated',
      },
    ]);
  });

  it('records a profile update only when identity state changes', () => {
    const aggregate = identity();
    const profile = IdentityProfile.fromPrimitives({
      banner: undefined,
      biography: 'Computing pioneer',
      handle: 'ada',
      name: 'Ada Lovelace',
      picture: undefined,
    });
    const memberships = IdentityNetworkMemberships.fromPrimitives([
      'network-a',
      'network-b',
    ]);

    aggregate.updateProfile(profile, memberships, new Timestamp(200));
    aggregate.updateProfile(profile, memberships, new Timestamp(300));

    expect(
      aggregate.belongsToNetwork(IdentityNetworkId.fromString('network-b')),
    ).toBe(true);
    expect(aggregate.pullDomainEvents()).toEqual([
      {
        aggregateId: 'identity-a',
        occurredAt: 200,
        type: 'IdentityProfileUpdated',
      },
    ]);
  });
});
