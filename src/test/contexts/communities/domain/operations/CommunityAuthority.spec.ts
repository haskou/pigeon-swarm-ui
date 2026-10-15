import { DomainError } from '@haskou/value-objects';

import { CommunityOperationRejectedError } from '../../../../../contexts/communities/domain/errors/CommunityOperationRejectedError';
import { CommunityAuthority } from '../../../../../contexts/communities/domain/operations/CommunityAuthority';
import { CommunityOperation } from '../../../../../contexts/communities/domain/operations/CommunityOperation';
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
