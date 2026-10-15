import type { GroupMailboxRosterChange } from '../../../../contexts/groupMailboxes/domain/GroupMailboxRosterChange';
import type { GroupMailboxRosterFields } from '../../../../contexts/groupMailboxes/domain/GroupMailboxRosterFields';

import { GroupMailboxRoster } from '../../../../contexts/groupMailboxes/domain/GroupMailboxRoster';

const CONVERSATION_ID = `group:${'A'.repeat(43)}`;

const fields = (
  change: Partial<GroupMailboxRosterFields> = {},
): GroupMailboxRosterFields => ({
  adminIds: ['admin', 'gone-admin'],
  conversationId: CONVERSATION_ID,
  creatorId: 'creator',
  memberIds: ['admin', 'creator', 'gone-admin', 'member', 'other'],
  name: 'Team',
  version: GroupMailboxRoster.VERSION,
  ...change,
});

const rosterOf = (
  change: Partial<GroupMailboxRosterFields> = {},
): GroupMailboxRoster => {
  const roster = GroupMailboxRoster.of(fields(change));

  if (!roster) throw new Error('Invalid roster fixture');

  return roster;
};

const roster = rosterOf();

const commit = (
  committer: string,
  change: Partial<Omit<GroupMailboxRosterChange, 'committer'>> = {},
): GroupMailboxRosterChange => ({
  added: [],
  committer,
  holders: ['admin', 'creator', 'member', 'member', 'other'],
  removed: [],
  ...change,
});

describe('GroupMailboxRoster', () => {
  describe('of', () => {
    it('accepts a well-formed roster and sorts its lists', () => {
      expect(
        rosterOf({
          memberIds: ['other', 'creator', 'member'],
          adminIds: [],
        }).toFields().memberIds,
      ).toEqual(['creator', 'member', 'other']);
    });

    it.each<[string, Partial<GroupMailboxRosterFields>]>([
      ['another version', { version: 2 }],
      ['a malformed conversation id', { conversationId: 'group:abc' }],
      [
        'a direct conversation id',
        { conversationId: `direct:${'A'.repeat(43)}` },
      ],
      ['an empty name', { name: '' }],
      ['an untrimmed name', { name: ' Team' }],
      ['a name too long', { name: 'x'.repeat(10_000) }],
      [
        'a repeated member',
        { memberIds: ['creator', 'creator'], adminIds: [] },
      ],
      ['an untrimmed identity', { memberIds: ['creator', ' x'], adminIds: [] }],
      [
        'an identity too long',
        { memberIds: ['creator', 'x'.repeat(1025)], adminIds: [] },
      ],
      ['a creator off the members', { creatorId: 'stranger' }],
      ['a creator among the admins', { adminIds: ['creator'] }],
      ['an admin off the members', { adminIds: ['stranger'] }],
      [
        'more members than the node allows',
        {
          adminIds: [],
          memberIds: [
            'creator',
            ...Array.from(
              { length: GroupMailboxRoster.MAX_PARTICIPANTS },
              (_, index) => `member-${index}`,
            ),
          ],
        },
      ],
    ])('rejects %s', (_, change) => {
      expect(GroupMailboxRoster.of(fields(change))).toBeUndefined();
    });

    it('holds exactly the node limit of members', () => {
      expect(
        GroupMailboxRoster.of(
          fields({
            adminIds: [],
            memberIds: [
              'creator',
              ...Array.from(
                { length: GroupMailboxRoster.MAX_PARTICIPANTS - 1 },
                (_, index) => `member-${index}`,
              ),
            ],
          }),
        ),
      ).toBeDefined();
    });
  });

  describe('operations', () => {
    it('refuses to add a member twice, or to remove, promote or demote one it does not hold', () => {
      expect(roster.withMember('member')).toBeUndefined();
      expect(roster.withoutMember('stranger')).toBeUndefined();
      expect(roster.promoted('admin')).toBeUndefined();
      expect(roster.promoted('stranger')).toBeUndefined();
      expect(roster.demoted('member')).toBeUndefined();
      expect(roster.withoutMember('creator')).toBeUndefined();
    });

    it('drops a removed admin from the admins', () => {
      expect(roster.withoutMember('admin')?.adminIds()).toEqual(['gone-admin']);
    });
  });

  describe('allowsCommit without a roster change', () => {
    it('lets any member rotate its own leaf or change its own devices', () => {
      expect(roster.allowsCommit(commit('member'))).toBe(true);
      expect(
        roster.allowsCommit(
          commit('member', { added: ['member'], removed: ['member'] }),
        ),
      ).toBe(true);
    });

    it('lets a manager add leaves of members, or remove those of strays', () => {
      expect(
        roster.allowsCommit(commit('admin', { added: ['other', 'admin'] })),
      ).toBe(true);
      expect(roster.allowsCommit(commit('admin', { removed: ['stray'] }))).toBe(
        true,
      );
    });

    it('rejects any added leaf while an identity off the roster holds one, as it would learn of it', () => {
      const holders = ['admin', 'creator', 'member', 'stray'];
      const joined = roster.withMember('newcomer') as GroupMailboxRoster;

      expect(
        roster.allowsCommit(commit('admin', { added: ['other'], holders })),
      ).toBe(false);
      expect(
        roster.allowsCommit(
          commit('admin', { added: ['admin'], holders, removed: ['stray'] }),
        ),
      ).toBe(false);
      expect(
        roster.allowsCommit(commit('member', { added: ['member'], holders })),
      ).toBe(false);
      expect(
        roster.allowsCommit(
          commit('admin', { added: ['newcomer'], holders }),
          joined,
        ),
      ).toBe(false);
      expect(
        roster.allowsCommit(commit('admin', { holders, removed: ['stray'] })),
      ).toBe(true);
    });

    it('rejects a member who is no manager touching another identity', () => {
      expect(roster.allowsCommit(commit('member', { added: ['other'] }))).toBe(
        false,
      );
      expect(
        roster.allowsCommit(commit('member', { removed: ['stray'] })),
      ).toBe(false);
    });

    it('rejects removing a member without the roster change', () => {
      expect(
        roster.allowsCommit(commit('creator', { removed: ['member'] })),
      ).toBe(false);
    });

    it('rejects adding a leaf of an identity off the roster', () => {
      expect(
        roster.allowsCommit(commit('creator', { added: ['stranger'] })),
      ).toBe(false);
    });

    it('rejects any commit by an identity off the roster', () => {
      expect(roster.allowsCommit(commit('stranger'))).toBe(false);
    });
  });

  describe('allowsCommit with a roster change', () => {
    const added = roster.withMember('newcomer') as GroupMailboxRoster;

    it('lets a manager add one member with its leaves', () => {
      expect(
        roster.allowsCommit(commit('admin', { added: ['newcomer'] }), added),
      ).toBe(true);
      expect(roster.allowsCommit(commit('creator'), added)).toBe(true);
    });

    it('rejects an add by a member who is no manager', () => {
      expect(
        roster.allowsCommit(commit('member', { added: ['newcomer'] }), added),
      ).toBe(false);
    });

    it('rejects an add that also adds or removes another leaf', () => {
      expect(
        roster.allowsCommit(
          commit('admin', { added: ['newcomer', 'other'] }),
          added,
        ),
      ).toBe(false);
      expect(
        roster.allowsCommit(
          commit('admin', { added: ['newcomer'], removed: ['stray'] }),
          added,
        ),
      ).toBe(false);
    });

    it('rejects two members added at once', () => {
      const two = added.withMember('second') as GroupMailboxRoster;

      expect(roster.allowsCommit(commit('creator'), two)).toBe(false);
    });

    it('rejects an add that also promotes', () => {
      const promoted = added.promoted('newcomer') as GroupMailboxRoster;

      expect(roster.allowsCommit(commit('creator'), promoted)).toBe(false);
    });

    it('lets a manager remove a member with all its leaves', () => {
      const removed = roster.withoutMember('member') as GroupMailboxRoster;

      expect(
        roster.allowsCommit(
          commit('admin', { removed: ['member', 'member'] }),
          removed,
        ),
      ).toBe(true);
    });

    it('rejects a removal that keeps one of the member leaves', () => {
      const removed = roster.withoutMember('member') as GroupMailboxRoster;

      expect(
        roster.allowsCommit(commit('admin', { removed: ['member'] }), removed),
      ).toBe(false);
    });

    it('rejects a removal or a leave that also adds a leaf, so the one dropped learns only the roster without itself', () => {
      const removed = roster.withoutMember('member') as GroupMailboxRoster;

      expect(
        roster.allowsCommit(
          commit('admin', { added: ['other'], removed: ['member', 'member'] }),
          removed,
        ),
      ).toBe(false);
      expect(
        roster.allowsCommit(commit('member', { added: ['other'] }), removed),
      ).toBe(false);
      expect(
        roster.allowsCommit(commit('member', { added: ['member'] }), removed),
      ).toBe(false);
    });

    it('rejects a removal whose leaves do not match the member removed', () => {
      const removed = roster.withoutMember('member') as GroupMailboxRoster;

      expect(
        roster.allowsCommit(
          commit('admin', { removed: ['other', 'member'] }),
          removed,
        ),
      ).toBe(false);
      expect(
        roster.allowsCommit(
          commit('admin', {
            added: ['other'],
            removed: ['member', 'member'],
          }),
          removed,
        ),
      ).toBe(false);
    });

    it('rejects a removal by a member who is no manager', () => {
      const removed = roster.withoutMember('other') as GroupMailboxRoster;

      expect(
        roster.allowsCommit(commit('member', { removed: ['other'] }), removed),
      ).toBe(false);
    });

    it('lets only the creator remove an admin, and nobody the creator', () => {
      const withoutAdmin = roster.withoutMember('admin') as GroupMailboxRoster;
      const change = { removed: ['admin'] };

      expect(roster.allowsCommit(commit('creator', change), withoutAdmin)).toBe(
        true,
      );
      expect(
        roster.allowsCommit(commit('gone-admin', change), withoutAdmin),
      ).toBe(false);

      const withoutCreator = GroupMailboxRoster.of({
        ...roster.toFields(),
        memberIds: roster.memberIds().filter((id) => id !== 'creator'),
      });

      expect(withoutCreator).toBeUndefined();
    });

    it('never holds an admin left among the admins once removed', () => {
      expect(
        GroupMailboxRoster.of({
          ...roster.toFields(),
          memberIds: roster.memberIds().filter((id) => id !== 'admin'),
        }),
      ).toBeUndefined();
    });

    it('lets a member leave, removing only its own leaves or strays', () => {
      const left = roster.withoutMember('member') as GroupMailboxRoster;

      expect(roster.allowsCommit(commit('member'), left)).toBe(true);
      expect(
        roster.allowsCommit(
          commit('member', { removed: ['member', 'stray'] }),
          left,
        ),
      ).toBe(true);
      expect(
        roster.allowsCommit(commit('member', { removed: ['other'] }), left),
      ).toBe(false);
    });

    it('lets an admin leave, leaving the admins with it', () => {
      expect(
        roster.allowsCommit(
          commit('admin'),
          roster.withoutMember('admin') as GroupMailboxRoster,
        ),
      ).toBe(true);
    });

    it('never lets the creator leave', () => {
      const left = GroupMailboxRoster.of({
        ...roster.toFields(),
        creatorId: 'admin',
        adminIds: ['gone-admin'],
        memberIds: roster.memberIds().filter((id) => id !== 'creator'),
      }) as GroupMailboxRoster;

      expect(roster.allowsCommit(commit('creator'), left)).toBe(false);
    });

    it('lets only the creator promote or demote', () => {
      const promoted = roster.promoted('member') as GroupMailboxRoster;
      const demoted = roster.demoted('admin') as GroupMailboxRoster;

      expect(roster.allowsCommit(commit('creator'), promoted)).toBe(true);
      expect(roster.allowsCommit(commit('creator'), demoted)).toBe(true);
      expect(roster.allowsCommit(commit('admin'), promoted)).toBe(false);
      expect(roster.allowsCommit(commit('admin'), demoted)).toBe(false);
    });

    it('rejects a promotion that removes a member leaf, even the committer own', () => {
      const promoted = roster.promoted('member') as GroupMailboxRoster;

      expect(
        roster.allowsCommit(
          commit('creator', { removed: ['stray'] }),
          promoted,
        ),
      ).toBe(true);
      expect(
        roster.allowsCommit(
          commit('creator', { removed: ['other'] }),
          promoted,
        ),
      ).toBe(false);
      expect(
        roster.allowsCommit(
          commit('creator', { removed: ['creator'] }),
          promoted,
        ),
      ).toBe(false);
      expect(
        roster.allowsCommit(commit('creator', { added: ['other'] }), promoted),
      ).toBe(false);
    });

    it('rejects two admin changes at once', () => {
      const both = (roster.promoted('member') as GroupMailboxRoster).demoted(
        'admin',
      ) as GroupMailboxRoster;

      expect(roster.allowsCommit(commit('creator'), both)).toBe(false);
    });

    it.each<[string, Partial<GroupMailboxRosterFields>]>([
      ['a rename', { name: 'Renamed' }],
      ['a creator change', { creatorId: 'admin', adminIds: ['gone-admin'] }],
      ['another conversation', { conversationId: `group:${'B'.repeat(42)}A` }],
    ])('rejects %s', (_, change) => {
      expect(roster.allowsCommit(commit('creator'), rosterOf(change))).toBe(
        false,
      );
    });

    it('rejects a commit that changes nothing on the roster but claims to', () => {
      expect(roster.allowsCommit(commit('creator'), rosterOf())).toBe(false);
    });
  });

  describe('committers and priority', () => {
    it('names the managers among the leaf holders, sorted', () => {
      expect(
        roster.committers(['member', 'creator', 'admin', 'stray', 'admin']),
      ).toEqual(['admin', 'creator']);
    });

    it('ranks the creator first, then removals of others, then the rest', () => {
      expect(roster.priorityOf({ committer: 'creator', removed: [] })).toBe(2);
      expect(
        roster.priorityOf({ committer: 'admin', removed: ['member'] }),
      ).toBe(1);
      expect(
        roster.priorityOf({ committer: 'admin', removed: ['admin'] }),
      ).toBe(0);
      expect(roster.priorityOf({ committer: 'member', removed: [] })).toBe(0);
    });
  });
});
