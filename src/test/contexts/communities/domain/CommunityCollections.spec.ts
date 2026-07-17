import { CommunityChannel } from '../../../../contexts/communities/domain/entities/CommunityChannel';
import { CommunityChannels } from '../../../../contexts/communities/domain/entities/CommunityChannels';
import { CommunityMembers } from '../../../../contexts/communities/domain/entities/CommunityMembers';
import { CommunityRoles } from '../../../../contexts/communities/domain/entities/CommunityRoles';
import { CommunityChannelId } from '../../../../contexts/communities/domain/value-objects/CommunityChannelId';
import { CommunityChannelName } from '../../../../contexts/communities/domain/value-objects/CommunityChannelName';
import { CommunityIdentityId } from '../../../../contexts/communities/domain/value-objects/CommunityIdentityId';
import { CommunityPermission } from '../../../../contexts/communities/domain/value-objects/CommunityPermission';
import { CommunityRoleId } from '../../../../contexts/communities/domain/value-objects/CommunityRoleId';
import { CommunityRoleName } from '../../../../contexts/communities/domain/value-objects/CommunityRoleName';

describe('community entity collections', () => {
  it('owns channel lookup and mutation', () => {
    const channels = CommunityChannels.fromPrimitives([
      {
        connectedIdentityIds: [],
        createdAt: 100,
        id: 'channel-a',
        name: 'general',
        type: 'text',
        visibleRoleIds: [],
      },
    ]);

    const renamed = channels.rename(
      CommunityChannelId.fromString('channel-a'),
      CommunityChannelName.fromString('operators'),
    );

    expect(renamed.belongsTo(CommunityChannelId.fromString('channel-a'))).toBe(
      true,
    );
    expect(() =>
      channels.remove(CommunityChannelId.fromString('missing')),
    ).toThrow('Community channel was not found.');
  });

  it('owns member lookup and role assignment', () => {
    const members = CommunityMembers.fromPrimitives([
      { banned: false, identityId: 'member-a', roleIds: [] },
    ]);

    const member = members.assignRoles(
      CommunityIdentityId.fromString('member-a'),
      [CommunityRoleId.fromString('member-role')],
    );

    expect(member.belongsTo(CommunityIdentityId.fromString('member-a'))).toBe(
      true,
    );
    expect(() =>
      members.ban(CommunityIdentityId.fromString('missing')),
    ).toThrow('Community member was not found.');
  });

  it('owns role lookup and mutation', () => {
    const roles = CommunityRoles.fromPrimitives([
      {
        builtIn: false,
        id: 'member-role',
        name: 'Member',
        permissions: ['view_channels'],
      },
    ]);

    const role = roles.update(
      CommunityRoleId.fromString('member-role'),
      CommunityRoleName.fromString('Operator'),
      [CommunityPermission.fromPrimitives('send_messages')],
    );

    expect(role.belongsTo(CommunityRoleId.fromString('member-role'))).toBe(
      true,
    );
    expect(() =>
      roles.assertExist([CommunityRoleId.fromString('missing')]),
    ).toThrow('Community role was not found.');
  });

  it('adds hydrated channels without exposing the collection', () => {
    const channels = CommunityChannels.fromPrimitives([]);

    channels.add(
      CommunityChannel.fromPrimitives({
        connectedIdentityIds: [],
        createdAt: 100,
        id: 'channel-a',
        name: 'general',
        type: 'text',
        visibleRoleIds: [],
      }),
    );

    expect(channels.toPrimitives()).toHaveLength(1);
  });
});
