import { CommunityOperation } from '../../../../../contexts/communities/domain/operations/CommunityOperation';
import { CommunityOperationFold } from '../../../../../contexts/communities/domain/operations/CommunityOperationFold';
import { CommunityRoleId } from '../../../../../contexts/communities/domain/value-objects/CommunityRoleId';
import { MlsTestIdentity } from '../../infrastructure/mls/MlsTestIdentity';

const COMMUNITY = 'community-1';

describe(CommunityOperationFold.name, () => {
  let cast: Record<string, MlsTestIdentity>;
  const id = (name: string): string => cast[name].id;
  const operation = (
    hash: string,
    author: string,
    action: string,
    args: Record<string, unknown>,
    parents: string[] = ['genesis'],
  ): CommunityOperation =>
    CommunityOperation.fromPrimitives({
      action,
      args,
      authorIdentityId: id(author),
      communityId: COMMUNITY,
      createdAt: 1,
      hash,
      networkId: 'network-1',
      parents,
    });
  const genesis = (): CommunityOperation =>
    operation(
      'genesis',
      'owner',
      CommunityOperation.GENESIS,
      {
        autoJoinEnabled: false,
        description: '',
        discoverable: false,
        name: 'Community',
        nonce: 'nonce-1',
        visibility: 'public',
      },
      [],
    );
  const added = (
    hash: string,
    author: string,
    member: string,
    parents?: string[],
  ): CommunityOperation =>
    operation(
      hash,
      author,
      'member_joined',
      { identityId: id(member), method: 'added' },
      parents,
    );

  beforeAll(async () => {
    cast = await MlsTestIdentity.cast(['owner', 'manager', 'member']);
  });

  it('proves nothing without a genesis', () => {
    expect(
      CommunityOperationFold.fold([added('a', 'owner', 'member')]),
    ).toBeUndefined();
  });

  it('applies parents first, whatever order the operations arrive in', () => {
    const roleId = CommunityRoleId.derive(COMMUNITY, id('owner'), 1).valueOf();
    const authority = CommunityOperationFold.fold([
      added('z-adds-member', 'manager', 'member', ['c-assigns']),
      operation(
        'c-assigns',
        'owner',
        'member_roles_updated',
        { identityId: id('manager'), roleIds: [roleId] },
        ['b-role', 'a-manager'],
      ),
      operation('b-role', 'owner', 'role_created', {
        name: 'Managers',
        permissions: ['manage_members'],
        roleId,
      }),
      added('a-manager', 'owner', 'manager'),
      genesis(),
    ]);

    expect(authority?.getMemberIds()).toEqual(
      ['owner', 'manager', 'member'].map(id),
    );
  });

  it('applies the lowest digest first among concurrent operations', () => {
    const authority = CommunityOperationFold.fold([
      genesis(),
      added('a-manager', 'owner', 'manager'),
      // Concurrent: the ban sorts first, so the later join is refused.
      added('c-member', 'owner', 'member', ['a-manager']),
      operation(
        'b-ban',
        'owner',
        'member_banned',
        { identityId: id('member') },
        ['a-manager'],
      ),
    ]);

    expect(authority?.getMemberIds()).toEqual(['owner', 'manager'].map(id));
  });

  it('skips what its state does not allow and what builds on an unknown parent', () => {
    const authority = CommunityOperationFold.fold([
      genesis(),
      added('a-forbidden', 'manager', 'member'),
      added('b-orphan', 'owner', 'manager', ['withheld']),
      added('c-built-on-orphan', 'owner', 'member', ['b-orphan']),
    ]);

    expect(authority?.getMemberIds()).toEqual([id('owner')]);
  });

  it('counts an operation served twice once', () => {
    const join = added('a-manager', 'owner', 'manager');
    const leave = operation(
      'b-leave',
      'manager',
      'member_left',
      { identityId: id('manager') },
      ['a-manager'],
    );

    expect(
      CommunityOperationFold.fold([
        genesis(),
        join,
        leave,
        join,
      ])?.getMemberIds(),
    ).toEqual([id('owner')]);
  });

  it('skips the operations of an author beyond the quota', () => {
    const roleId = CommunityRoleId.derive(COMMUNITY, id('owner'), 1).valueOf();
    const flood = Array.from({ length: 1_000 }, (_, index) =>
      operation(
        `f-${String(index).padStart(4, '0')}`,
        'manager',
        'channel_created',
        {},
        ['d-assigns'],
      ),
    );
    const authority = CommunityOperationFold.fold([
      genesis(),
      added('a-manager', 'owner', 'manager'),
      operation('b-role', 'owner', 'role_created', {
        name: 'Managers',
        permissions: ['manage_members'],
        roleId,
      }),
      operation(
        'd-assigns',
        'owner',
        'member_roles_updated',
        { identityId: id('manager'), roleIds: [roleId] },
        ['a-manager', 'b-role'],
      ),
      ...flood,
      added('z-over-quota', 'manager', 'member', ['f-0999']),
    ]);

    expect(authority?.getMemberIds()).toEqual(['owner', 'manager'].map(id));
  });

  it('proves nothing once the community is deleted', () => {
    expect(
      CommunityOperationFold.fold([
        genesis(),
        operation('a-left', 'owner', 'member_left', {
          identityId: id('owner'),
        }),
        added('b-after', 'owner', 'member', ['a-left']),
      ]),
    ).toBeUndefined();
  });
});
