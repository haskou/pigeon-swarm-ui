import { DomainError } from '@haskou/value-objects';

import { CommunityOperationRejectedError } from '../../../../../contexts/communities/domain/errors/CommunityOperationRejectedError';
import { CommunityAuthority } from '../../../../../contexts/communities/domain/operations/CommunityAuthority';
import { CommunityOperation } from '../../../../../contexts/communities/domain/operations/CommunityOperation';
import { CommunityChannelId } from '../../../../../contexts/communities/domain/value-objects/CommunityChannelId';
import { CommunityRoleId } from '../../../../../contexts/communities/domain/value-objects/CommunityRoleId';
import { MlsTestIdentity } from '../../infrastructure/mls/MlsTestIdentity';

const COMMUNITY = 'community-1';
const NETWORK = 'network-1';

describe(CommunityAuthority.name, () => {
  let cast: Record<string, MlsTestIdentity>;
  let authority: CommunityAuthority;
  let createdAt: number;
  const id = (name: string): string => cast[name].id;
  const operation = (
    author: string,
    action: string,
    args: Record<string, unknown>,
  ): CommunityOperation => {
    createdAt += 1;

    return CommunityOperation.fromPrimitives({
      action,
      args,
      authorIdentityId: id(author),
      communityId: COMMUNITY,
      createdAt,
      hash: `hash-${createdAt}`,
      networkId: NETWORK,
      parents: action === CommunityOperation.GENESIS ? [] : ['parent'],
    });
  };
  const apply = (
    author: string,
    action: string,
    args: Record<string, unknown>,
  ): void => authority.apply(operation(author, action, args));
  const add = (author: string, member: string): void =>
    apply(author, 'member_joined', { identityId: id(member), method: 'added' });
  /** `author` creates a role with `permissions`; returns its id. */
  const createRole = (author: string, permissions: string[]): string => {
    const roleId = CommunityRoleId.derive(
      COMMUNITY,
      id(author),
      createdAt + 1,
    ).valueOf();

    apply(author, 'role_created', { name: 'Role', permissions, roleId });

    return roleId;
  };
  const assign = (author: string, member: string, roleIds: string[]): void =>
    apply(author, 'member_roles_updated', { identityId: id(member), roleIds });
  /** `author` creates a text channel; returns its id. */
  const createChannel = (author: string): string => {
    const channelId = CommunityChannelId.derive(
      COMMUNITY,
      id(author),
      createdAt + 1,
    ).valueOf();

    apply(author, 'channel_created', {
      channelId,
      name: 'Channel',
      type: 'text',
    });

    return channelId;
  };
  const restrict = (
    author: string,
    channelId: string,
    visibleRoleIds: string[],
  ): void =>
    apply(author, 'channel_permissions_updated', { channelId, visibleRoleIds });
  const access = (channelId: string): boolean[] =>
    ['owner', 'manager', 'member', 'other'].map((name) =>
      authority.canAccessChannel(id(name), channelId),
    );

  beforeAll(async () => {
    cast = await MlsTestIdentity.cast(['owner', 'manager', 'member', 'other']);
  });

  beforeEach(() => {
    createdAt = 0;
    authority = CommunityAuthority.create(
      operation('owner', CommunityOperation.GENESIS, {
        autoJoinEnabled: false,
        description: '',
        discoverable: false,
        name: 'Community',
        nonce: 'nonce-1',
        visibility: 'public',
      }),
    );
    add('owner', 'manager');
    add('owner', 'member');
    assign('owner', 'manager', [createRole('owner', ['manage_members'])]);
  });

  it('derives role ids like the node', () => {
    expect(
      CommunityRoleId.derive(
        'community-1',
        'MCowBQYDK2VwAyEAqB+GBbuXZLmdsbPWs3Ie0lfU6Nj9ab7x0HCHHivC1HM=',
        1773848829055,
      ).valueOf(),
    ).toBe('a192ffe0027d7963dc09915f');
  });

  it('gives the owner every permission, members those of their roles, others none', () => {
    expect(authority.getOwnerIdentityId()).toBe(id('owner'));
    expect(authority.getMemberIds()).toEqual(
      ['owner', 'manager', 'member'].map(id),
    );
    expect(authority.hasPermission(id('owner'), 'manage_roles')).toBe(true);
    expect(authority.hasPermission(id('manager'), 'manage_members')).toBe(true);
    expect(authority.hasPermission(id('member'), 'manage_members')).toBe(false);
    expect(authority.hasPermission(id('member'), 'send_messages')).toBe(true);
    expect(authority.hasPermission(id('other'), 'send_messages')).toBe(false);
  });

  it('holds the visibility its genesis signs, which no update changes', () => {
    expect(() =>
      apply('owner', 'community_updated', {
        description: '',
        name: 'Community',
        visibility: 'private',
      }),
    ).toThrow(CommunityOperationRejectedError);
    expect(authority.getVisibility().isPublic()).toBe(true);
  });

  it('rejects a genesis whose visibility is neither public nor private', () => {
    expect(() =>
      CommunityAuthority.create(
        operation('owner', CommunityOperation.GENESIS, {
          autoJoinEnabled: false,
          description: '',
          discoverable: false,
          name: 'Community',
          nonce: 'nonce-2',
          visibility: 'unlisted',
        }),
      ),
    ).toThrow(DomainError);
  });

  it('lets a manager add members, and rejects a member who may not', () => {
    add('manager', 'other');

    expect(authority.getMemberIds()).toContain(id('other'));
    expect(() =>
      apply('member', 'member_kicked', { identityId: id('other') }),
    ).toThrow(CommunityOperationRejectedError);
  });

  it('rejects a role made or granted without manage_roles, changing nothing', () => {
    expect(() => createRole('manager', ['manage_members'])).toThrow(
      CommunityOperationRejectedError,
    );
    expect(() =>
      assign('manager', 'member', [
        CommunityRoleId.derive(COMMUNITY, id('owner'), 4).valueOf(),
      ]),
    ).toThrow(CommunityOperationRejectedError);
    expect(authority.hasPermission(id('member'), 'manage_members')).toBe(false);
  });

  it('rejects a role whose id its creator did not derive', () => {
    expect(() =>
      apply('owner', 'role_created', {
        name: 'Role',
        permissions: ['manage_members'],
        roleId: 'chosen-by-the-node',
      }),
    ).toThrow(CommunityOperationRejectedError);
  });

  it('rejects assigning a role that does not exist or to a non-member', () => {
    expect(() => assign('owner', 'member', ['missing'])).toThrow(
      CommunityOperationRejectedError,
    );
    expect(() => assign('owner', 'other', ['everyone'])).toThrow(
      CommunityOperationRejectedError,
    );
  });

  it('takes a right away when its role loses the permission', () => {
    const roleId = createRole('owner', ['send_messages']);

    assign('owner', 'member', [roleId]);
    apply('owner', 'role_updated', {
      name: 'Role',
      permissions: ['manage_members'],
      roleId,
    });
    expect(authority.hasPermission(id('member'), 'manage_members')).toBe(true);
    apply('owner', 'role_deleted', { roleId });

    expect(authority.hasPermission(id('member'), 'manage_members')).toBe(false);
  });

  it('removes a banned member and keeps them out until unbanned', () => {
    apply('owner', 'member_banned', { identityId: id('member') });

    expect(authority.getMemberIds()).not.toContain(id('member'));
    expect(() => add('manager', 'member')).toThrow(
      CommunityOperationRejectedError,
    );
    apply('owner', 'member_unbanned', { identityId: id('member') });
    add('manager', 'member');
    expect(authority.getMemberIds()).toContain(id('member'));
  });

  it('never removes the owner, and lets members leave only themselves', () => {
    expect(() =>
      apply('manager', 'member_kicked', { identityId: id('owner') }),
    ).toThrow(CommunityOperationRejectedError);
    expect(() =>
      apply('manager', 'member_left', { identityId: id('member') }),
    ).toThrow(CommunityOperationRejectedError);
    apply('member', 'member_left', { identityId: id('member') });

    expect(authority.getMemberIds()).not.toContain(id('member'));
  });

  it('compares identities as the node does, whatever form an argument has', () => {
    const pem = `-----BEGIN PUBLIC KEY-----\n${id('manager')}\n-----END PUBLIC KEY-----\n`;

    apply('owner', 'member_roles_updated', { identityId: pem, roleIds: [] });

    expect(authority.hasPermission(id('manager'), 'manage_members')).toBe(
      false,
    );
  });

  it('rejects arguments the action does not take and actions it does not know', () => {
    expect(() =>
      apply('owner', 'member_joined', {
        identityId: id('other'),
        method: 'added',
        roleIds: ['everyone'],
      }),
    ).toThrow(CommunityOperationRejectedError);
    expect(() => apply('owner', 'constructor', {})).toThrow(
      CommunityOperationRejectedError,
    );
  });

  it('derives channel ids like the node', () => {
    expect(
      CommunityChannelId.derive(
        'community-1',
        'MCowBQYDK2VwAyEAqB+GBbuXZLmdsbPWs3Ie0lfU6Nj9ab7x0HCHHivC1HM=',
        1773848829055,
      ).valueOf(),
    ).toBe('0d906d967047c86809549941');
  });

  it('lets only the owner and members of a visible role into a restricted channel', () => {
    const channelId = createChannel('owner');
    const roleId = createRole('owner', []);

    expect(authority.isChannelRestricted(channelId)).toBe(false);
    expect(access(channelId)).toEqual([true, true, true, false]);

    assign('owner', 'member', [roleId]);
    restrict('owner', channelId, [roleId]);

    expect(authority.isChannelRestricted(channelId)).toBe(true);
    expect(authority.getRestrictedChannelIds()).toEqual([channelId]);
    expect(access(channelId)).toEqual([true, false, true, false]);

    restrict('owner', channelId, []);

    expect(authority.isChannelRestricted(channelId)).toBe(false);
    expect(access(channelId)).toEqual([true, true, true, false]);
  });

  it('takes a restricted channel away from a member who loses the role or leaves', () => {
    const channelId = createChannel('owner');
    const roleId = createRole('owner', []);

    assign('owner', 'member', [roleId]);
    assign('owner', 'manager', [roleId]);
    restrict('owner', channelId, [roleId]);
    assign('owner', 'member', []);
    apply('owner', 'member_kicked', { identityId: id('manager') });

    expect(access(channelId)).toEqual([true, false, false, false]);
  });

  it('rejects channel changes made without manage_channels, changing nothing', () => {
    const channelId = createChannel('owner');
    const roleId = createRole('owner', []);

    expect(() => createChannel('manager')).toThrow(
      CommunityOperationRejectedError,
    );
    expect(() => restrict('manager', channelId, [roleId])).toThrow(
      CommunityOperationRejectedError,
    );
    expect(() => apply('member', 'channel_deleted', { channelId })).toThrow(
      CommunityOperationRejectedError,
    );
    expect(authority.isChannelRestricted(channelId)).toBe(false);
    expect(access(channelId)).toEqual([true, true, true, false]);

    assign('owner', 'member', [createRole('owner', ['manage_channels'])]);
    restrict('member', channelId, [roleId]);

    expect(authority.isChannelRestricted(channelId)).toBe(true);
  });

  it('rejects a channel whose id its creator did not derive, and changes to channels that do not exist', () => {
    expect(() =>
      apply('owner', 'channel_created', {
        channelId: 'chosen-by-the-node',
        name: 'Channel',
        type: 'text',
      }),
    ).toThrow(CommunityOperationRejectedError);
    expect(() =>
      apply('owner', 'channel_created', {
        channelId: CommunityChannelId.derive(
          COMMUNITY,
          id('owner'),
          createdAt + 1,
        ).valueOf(),
        name: 'Channel',
        type: 'stage',
      }),
    ).toThrow(CommunityOperationRejectedError);
    expect(() => restrict('owner', 'missing', [])).toThrow(
      CommunityOperationRejectedError,
    );
    expect(() =>
      apply('owner', 'channel_renamed', { channelId: 'missing', name: 'x' }),
    ).toThrow(CommunityOperationRejectedError);
    expect(access('missing')).toEqual([false, false, false, false]);
    expect(authority.isChannelRestricted('missing')).toBe(false);
  });

  it('accepts the channel names the node accepts', () => {
    const channelId = createChannel('owner');

    apply('owner', 'channel_renamed', { channelId, name: '' });

    expect(() =>
      apply('owner', 'channel_renamed', { channelId, name: 'x'.repeat(81) }),
    ).toThrow(CommunityOperationRejectedError);
  });

  it('shuts a deleted channel to everyone', () => {
    const channelId = createChannel('owner');

    restrict('owner', channelId, [createRole('owner', [])]);
    apply('owner', 'channel_deleted', { channelId });

    expect(access(channelId)).toEqual([false, false, false, false]);
    expect(authority.getRestrictedChannelIds()).toEqual([]);
    expect(() => restrict('owner', channelId, [])).toThrow(
      CommunityOperationRejectedError,
    );
  });

  it('rejects an operation of another community', () => {
    expect(() =>
      authority.apply(
        CommunityOperation.fromPrimitives({
          action: 'member_joined',
          args: { identityId: id('other'), method: 'added' },
          authorIdentityId: id('owner'),
          communityId: 'community-2',
          createdAt: 99,
          hash: 'hash-99',
          networkId: NETWORK,
          parents: ['parent'],
        }),
      ),
    ).toThrow(CommunityOperationRejectedError);
  });
});
