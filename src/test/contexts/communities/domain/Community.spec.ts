import { Timestamp } from '@haskou/value-objects';

import { Community } from '../../../../contexts/communities/domain/Community';
import { CommunityChannelId } from '../../../../contexts/communities/domain/value-objects/CommunityChannelId';
import { CommunityChannelName } from '../../../../contexts/communities/domain/value-objects/CommunityChannelName';
import { CommunityIdentityId } from '../../../../contexts/communities/domain/value-objects/CommunityIdentityId';
import { CommunityPermission } from '../../../../contexts/communities/domain/value-objects/CommunityPermission';
import { CommunityRoleId } from '../../../../contexts/communities/domain/value-objects/CommunityRoleId';

const community = (): Community =>
  Community.fromPrimitives({
    channels: [
      {
        connectedIdentityIds: [],
        createdAt: 100,
        id: 'channel-a',
        name: 'general',
        type: 'text',
        visibleRoleIds: ['member-role'],
      },
    ],
    members: [
      { banned: false, identityId: 'owner-a', roleIds: [] },
      {
        banned: false,
        identityId: 'member-a',
        roleIds: ['member-role'],
      },
    ],
    metadata: {
      createdAt: 100,
      id: 'community-a',
      networkId: 'network-a',
      ownerIdentityId: 'owner-a',
    },
    profile: {
      avatar: undefined,
      banner: undefined,
      description: 'A community',
      name: 'Builders',
    },
    publication: {
      autoJoinEnabled: false,
      discoverable: true,
      visibility: 'private',
    },
    roles: [
      {
        builtIn: false,
        id: 'member-role',
        name: 'Member',
        permissions: ['view_channels', 'send_messages'],
      },
    ],
  });

describe(Community.name, () => {
  it('owns channel visibility and permission decisions', () => {
    const aggregate = community();
    const memberId = CommunityIdentityId.fromString('member-a');

    expect(
      aggregate.canSeeChannel(
        CommunityChannelId.fromString('channel-a'),
        memberId,
      ),
    ).toBe(true);
    expect(
      aggregate
        .permissionsFor(memberId)
        .some((permission) =>
          permission.isEqual(
            CommunityPermission.fromPrimitives('send_messages'),
          ),
        ),
    ).toBe(true);
  });

  it('renames channels and records the domain fact', () => {
    const aggregate = community();

    aggregate.renameChannel(
      CommunityChannelId.fromString('channel-a'),
      CommunityChannelName.fromString('operators'),
      new Timestamp(200),
    );

    expect(aggregate.pullDomainEvents()).toEqual([
      {
        aggregateId: 'community-a',
        occurredAt: 200,
        type: 'CommunityChannelRenamed',
      },
    ]);
  });

  it('rejects assigning a role that does not belong to the community', () => {
    const aggregate = community();

    expect(() =>
      aggregate.assignMemberRoles(
        CommunityIdentityId.fromString('member-a'),
        [CommunityRoleId.fromString('missing-role')],
        new Timestamp(200),
      ),
    ).toThrow('Community role was not found.');
  });
});
