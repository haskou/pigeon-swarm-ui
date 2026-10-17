import { CommunityOperation } from '../../../../../contexts/communities/domain/operations/CommunityOperation';
import { CommunityOperationFold } from '../../../../../contexts/communities/domain/operations/CommunityOperationFold';
import {
  admission,
  alice,
  assignRoles,
  ban,
  bob,
  DAY,
  genesis,
  Invitation,
  invitation,
  join,
  kick,
  leave,
  mallory,
  operation,
  owner,
  revoke,
  role,
} from './CommunityOperationFixtures';

/** A deterministic shuffle: the fold must not depend on arrival order. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = seed;

  for (let index = result.length - 1; index > 0; index--) {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    const other = state % (index + 1);

    [result[index], result[other]] = [result[other], result[index]];
  }

  return result;
}

function stateOf(operations: CommunityOperation[]): {
  members: string[];
  skipped: string[];
} {
  const state = CommunityOperationFold.state(operations);

  return {
    members: state.authority?.getMemberIds().sort() ?? [],
    skipped: [...state.skipped].sort(),
  };
}

describe('CommunityOperationFold invitations', () => {
  const created = genesis();
  const managers = role([created], ['create_invites', 'manage_members'], 2);
  const malloryJoins = join([managers], mallory);
  const base = assignRoles([malloryJoins], mallory, [managers], owner, 3);
  const history = [created, managers, malloryJoins, base];

  function invitationIn(
    operations: CommunityOperation[],
    invited: Invitation,
  ): { live: boolean; revoked: boolean; uses: number } | undefined {
    const state = CommunityOperationFold.state(operations);

    return state.authority
      ? state.invitations
          .find(invited.operation.getHash())
          ?.toPrimitives(state.authority)
      : undefined;
  }

  function expectConverges(operations: CommunityOperation[]): {
    members: string[];
    skipped: string[];
  } {
    const expected = stateOf(operations);

    for (let seed = 1; seed <= 20; seed++) {
      expect(stateOf(shuffled(operations, seed))).toEqual(expected);
    }

    return expected;
  }

  it('admits an invitation, its admissions, a later join and its revocation', () => {
    const invited = invitation([base], owner, {}, 10);
    const admitted = admission([invited.operation], invited, alice, owner, 11);
    const revoked = revoke([admitted], invited);
    const later = join([revoked], bob);
    const operations = [
      ...history,
      invited.operation,
      admitted,
      revoked,
      later,
    ];

    expect(expectConverges(operations)).toMatchObject({ skipped: [] });
    expect(invitationIn(operations, invited)).toMatchObject({
      live: false,
      revoked: true,
      uses: 1,
    });
  });

  it('admits concurrent admissions under one invitation on every replica', () => {
    const invited = invitation([base], owner, {}, 10);
    const admitted = [alice, bob].map((joiner) =>
      admission([invited.operation], invited, joiner, owner, 11),
    );
    const operations = [...history, invited.operation, ...admitted];
    const expected = expectConverges(operations);

    expect(expected.members).toEqual(expect.arrayContaining([alice, bob]));
    expect(expected.skipped).toEqual([]);
    expect(invitationIn(operations, invited)).toMatchObject({
      live: true,
      uses: 2,
    });
  });

  it('keeps concurrent admissions beyond maxUses and closes the invitation', () => {
    const invited = invitation([base], owner, { maxUses: 1 }, 10);
    const admitted = [alice, bob].map((joiner) =>
      admission([invited.operation], invited, joiner, owner, 11),
    );
    const operations = [...history, invited.operation, ...admitted];

    expect(expectConverges(operations).members).toEqual(
      expect.arrayContaining([alice, bob]),
    );
    expect(invitationIn(operations, invited)).toMatchObject({
      live: false,
      uses: 2,
    });
  });

  it('counts one joiner admitted twice concurrently as one use and skips the second join', () => {
    const invited = invitation([base], owner, {}, 10);
    const byOwner = admission([invited.operation], invited, alice, owner, 11);
    const byMallory = admission(
      [invited.operation],
      invited,
      alice,
      mallory,
      12,
    );
    const operations = [...history, invited.operation, byOwner, byMallory];
    const expected = expectConverges(operations);

    expect(expected.skipped).toHaveLength(1);
    expect(invitationIn(operations, invited)?.uses).toBe(1);
  });

  it('charges sibling admissions of one joiner to their admitter, never to the joiner', () => {
    const invited = invitation([base], owner, {}, 10);
    const siblings = Array.from({ length: 1_000 }, (_, index) =>
      admission([invited.operation], invited, alice, mallory, 11 + index),
    );
    const left = leave(siblings, alice);
    const state = stateOf([...history, invited.operation, ...siblings, left]);

    expect(state.members).not.toContain(alice);
    expect(state.skipped).not.toContain(left.getHash());
  });

  it('keeps an admission concurrent with the revocation of its invitation', () => {
    const invited = invitation([base], owner, {}, 10);
    const admitted = admission([invited.operation], invited, alice, owner, 11);
    const revoked = revoke([invited.operation], invited, mallory);
    const operations = [...history, invited.operation, admitted, revoked];

    expect(expectConverges(operations).members).toContain(alice);
    expect(invitationIn(operations, invited)).toMatchObject({
      live: false,
      revoked: true,
    });
  });

  it('voids the invitation and admissions of an issuer kicked concurrently', () => {
    const invited = invitation([base], mallory, {}, 10);
    const admitted = admission(
      [invited.operation],
      invited,
      alice,
      mallory,
      11,
    );
    const kicked = kick([base], mallory, owner, 12);
    const operations = [...history, invited.operation, admitted, kicked];
    const expected = expectConverges(operations);

    expect(expected.members).not.toContain(alice);
    expect(expected.skipped).toEqual(
      expect.arrayContaining([invited.operation.getHash(), admitted.getHash()]),
    );
    expect(invitationIn(operations, invited)).toBeUndefined();
  });

  it('voids an admission of an owner invitation by an admitter kicked concurrently', () => {
    const invited = invitation([base], owner, {}, 10);
    const admitted = admission(
      [invited.operation],
      invited,
      alice,
      mallory,
      11,
    );
    const kicked = kick([invited.operation], mallory, owner, 12);
    const operations = [...history, invited.operation, admitted, kicked];
    const expected = expectConverges(operations);

    expect(expected.members).not.toContain(alice);
    expect(expected.skipped).toContain(admitted.getHash());
    expect(invitationIn(operations, invited)).toMatchObject({
      live: true,
      uses: 1,
    });
  });

  it('keeps what an issuer admitted before its kick and closes its invitation for good', () => {
    const invited = invitation([base], mallory, {}, 10);
    const admitted = admission(
      [invited.operation],
      invited,
      alice,
      mallory,
      11,
    );
    const kicked = kick([admitted], mallory, owner, 12);
    const readded = join([kicked], mallory);
    const promoted = assignRoles([readded], mallory, [managers], owner, 13);
    const operations = [
      ...history,
      invited.operation,
      admitted,
      kicked,
      readded,
      promoted,
    ];

    expect(expectConverges(operations).members).toEqual(
      expect.arrayContaining([alice, mallory]),
    );
    expect(invitationIn(operations, invited)?.live).toBe(false);
  });

  describe('what its causal past refuses', () => {
    it('refuses an invitation reusing a key of its past, even a revoked one', () => {
      const first = invitation([base], owner, {}, 10, 'shared');
      const revoked = revoke([first.operation], first);
      const second = invitation([revoked], owner, {}, 11, 'shared');

      expect(
        stateOf([...history, first.operation, revoked, second.operation])
          .skipped,
      ).toEqual([second.operation.getHash()]);
    });

    it('refuses an invitation by an issuer without create_invites', () => {
      const invited = invitation([base], alice, {}, 10);

      expect(stateOf([...history, invited.operation]).skipped).toEqual([
        invited.operation.getHash(),
      ]);
    });

    it('refuses an admission by an admitter without manage_members', () => {
      const invited = invitation([base], owner, {}, 10);
      const admitted = admission([invited.operation], invited, alice, bob, 11);

      expect(
        stateOf([...history, invited.operation, admitted]).skipped,
      ).toEqual([admitted.getHash()]);
    });

    it('refuses an admission under an invitation outside its causal past', () => {
      const invited = invitation([base], owner, {}, 10);
      const sibling = join([base], bob);
      const admitted = admission([sibling], invited, alice, owner, 11);
      const operations = [...history, invited.operation, sibling, admitted];
      const state = CommunityOperationFold.state(operations);

      expect(state.skipped).toContain(admitted.getHash());
      expect(state.authority?.getMemberIds()).not.toContain(alice);
      expect(invitationIn(operations, invited)?.uses).toBe(0);
    });

    it('admits an admission signed at either end of the window', () => {
      const invited = invitation([base], owner, {}, 10);
      const atStart = admission([invited.operation], invited, alice, owner, 10);
      const atEnd = admission(
        [invited.operation],
        invited,
        bob,
        owner,
        10 + 7 * DAY,
      );

      expect(
        stateOf([...history, invited.operation, atStart, atEnd]).skipped,
      ).toEqual([]);
    });

    it('refuses an admission outside the window', () => {
      const invited = invitation([base], owner, {}, 10);
      const early = admission([invited.operation], invited, alice, owner, 9);
      const late = admission(
        [invited.operation],
        invited,
        bob,
        owner,
        11 + 7 * DAY,
      );

      expect(
        stateOf([...history, invited.operation, early, late]).skipped.sort(),
      ).toEqual([early.getHash(), late.getHash()].sort());
    });

    it('refuses a second admission of one identity, even after it left', () => {
      const invited = invitation([base], owner, {}, 10);
      const admitted = admission(
        [invited.operation],
        invited,
        alice,
        owner,
        11,
      );
      const left = leave([admitted], alice);
      const again = admission([left], invited, alice, owner, 12);

      expect(
        stateOf([...history, invited.operation, admitted, left, again]).skipped,
      ).toEqual([again.getHash()]);
    });

    it('refuses an admission once the uses are exhausted', () => {
      const invited = invitation([base], owner, { maxUses: 1 }, 10);
      const first = admission([invited.operation], invited, alice, owner, 11);
      const second = admission([first], invited, bob, owner, 12);

      expect(
        stateOf([...history, invited.operation, first, second]).skipped,
      ).toEqual([second.getHash()]);
    });

    it('refuses the admission of a banned identity', () => {
      const invited = invitation([base], owner, {}, 10);
      const banned = ban([invited.operation], alice);
      const admitted = admission([banned], invited, alice, owner, 11);

      expect(
        stateOf([...history, invited.operation, banned, admitted]).skipped,
      ).toEqual([admitted.getHash()]);
    });

    it('refuses an admission under a revoked invitation', () => {
      const invited = invitation([base], owner, {}, 10);
      const revoked = revoke([invited.operation], invited);
      const admitted = admission([revoked], invited, alice, owner, 11);

      expect(
        stateOf([...history, invited.operation, revoked, admitted]).skipped,
      ).toEqual([admitted.getHash()]);
    });

    it('refuses an admission under the invitation of a banned issuer', () => {
      const invited = invitation([base], mallory, {}, 10);
      const banned = ban([invited.operation], mallory);
      const admitted = admission([banned], invited, alice, owner, 11);

      expect(
        stateOf([...history, invited.operation, banned, admitted]).skipped,
      ).toContain(admitted.getHash());
    });

    it('refuses a second revocation and a revocation of an unknown invitation', () => {
      const invited = invitation([base], owner, {}, 10);
      const other = invitation([base], owner, {}, 11);
      const revoked = revoke([invited.operation], invited);
      const again = revoke([revoked], invited);
      const unknown = revoke([invited.operation], other);

      expect(
        stateOf([
          ...history,
          invited.operation,
          revoked,
          again,
          unknown,
        ]).skipped.sort(),
      ).toEqual([again.getHash(), unknown.getHash()].sort());
    });

    it('refuses a revocation by a member that neither issued it nor manages members', () => {
      const invited = invitation([base], mallory, {}, 10);
      const joined = join([invited.operation], alice);
      const revoked = revoke([joined], invited, alice);

      expect(
        stateOf([...history, invited.operation, joined, revoked]).skipped,
      ).toEqual([revoked.getHash()]);
    });

    it('lets an issuer revoke while a member, and not once removed', () => {
      const invited = invitation([base], mallory, {}, 10);
      const own = revoke([invited.operation], invited, mallory);
      const other = invitation([base], mallory, {}, 11);
      const removed = kick([other.operation, own], mallory);
      const late = revoke([removed], other, mallory);

      expect(
        stateOf([
          ...history,
          invited.operation,
          own,
          other.operation,
          removed,
          late,
        ]).skipped,
      ).toEqual([late.getHash()]);
    });
  });

  describe('what no operation may carry', () => {
    it('refuses a non-canonical identity as joiner or author', () => {
      const invited = invitation([base], owner, {}, 10);
      const forged = admission([invited.operation], invited, alice, owner, 11, {
        identityId: `${alice.slice(0, -2)}AA`,
      });
      const strange = operation(
        'member_joined',
        owner,
        { identityId: 'not-an-identity', method: 'added' },
        [base],
      );

      expect(
        stateOf([
          ...history,
          invited.operation,
          forged,
          strange,
        ]).skipped.sort(),
      ).toEqual([forged.getHash(), strange.getHash()].sort());
    });

    it('refuses invitation arguments outside the exact shape', () => {
      const tooMany = invitation([base], owner, { maxUses: 101 }, 10);
      const tooLong = invitation(
        [base],
        owner,
        { expiresAt: 10 + 31 * DAY },
        11,
      );
      const bound = invitation([base], owner, { invitee: alice }, 12);
      const extra = invitation([base], owner, { note: 'x' }, 13);

      expect(
        stateOf([
          ...history,
          tooMany.operation,
          tooLong.operation,
          bound.operation,
          extra.operation,
        ]).skipped.sort(),
      ).toEqual(
        [
          tooMany.operation.getHash(),
          tooLong.operation.getHash(),
          bound.operation.getHash(),
          extra.operation.getHash(),
        ].sort(),
      );
    });

    it('admits only the invitee of a bound single-use invitation', () => {
      const bound = invitation(
        [base],
        owner,
        { invitee: alice, maxUses: 1 },
        10,
      );
      const wrong = admission([bound.operation], bound, bob, owner, 11);
      const right = admission([bound.operation], bound, alice, owner, 12);

      expect(
        stateOf([...history, bound.operation, wrong, right]).skipped,
      ).toEqual([wrong.getHash()]);
    });

    it('refuses a possession that does not match the invitation key', () => {
      const invited = invitation([base], owner, {}, 10);
      const stranger = invitation([base], owner, {}, 11);
      const forged = admission([invited.operation], invited, alice, owner, 11, {
        possession: stranger.key.signPossession({
          communityId: 'community-1',
          identityId: alice,
          invitationId: invited.operation.getHash(),
          networkId: String(invited.operation.getNetworkId()),
        }),
      });

      expect(stateOf([...history, invited.operation, forged]).skipped).toEqual([
        forged.getHash(),
      ]);
    });
  });
});
