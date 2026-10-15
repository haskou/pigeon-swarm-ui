import { GroupMailboxRoster } from '../../../../contexts/groupMailboxes/domain/GroupMailboxRoster';

const managed = GroupMailboxRoster.of({
  adminIds: ['admin', 'gone-admin'],
  creatorId: 'creator',
  participantIds: ['admin', 'creator', 'member', 'other'],
});

const unmanaged = GroupMailboxRoster.of({
  adminIds: [],
  participantIds: ['member', 'other'],
});

/** A commit's rank against its same-epoch rivals in the managed roster. */
const rankOf = (committer: string, removed: string[] = []): number =>
  managed.priorityOf({ committer, removed });

describe('GroupMailboxRoster', () => {
  it('lets the creator and an admin add a roster member', () => {
    for (const committer of ['creator', 'admin']) {
      expect(
        managed.allowsCommit({ added: ['other'], committer, removed: [] }),
      ).toBe(true);
    }
  });

  it('rejects an add by a member who is not an admin', () => {
    expect(
      managed.allowsCommit({
        added: ['other'],
        committer: 'member',
        removed: [],
      }),
    ).toBe(false);
  });

  it('rejects an add of an identity off the roster', () => {
    expect(
      managed.allowsCommit({
        added: ['outsider'],
        committer: 'creator',
        removed: [],
      }),
    ).toBe(false);
  });

  it('rejects a removal by a member who is not an admin', () => {
    expect(
      managed.allowsCommit({
        added: [],
        committer: 'member',
        removed: ['other'],
      }),
    ).toBe(false);
  });

  it('lets an admin remove a member but not another admin', () => {
    expect(
      managed.allowsCommit({
        added: [],
        committer: 'admin',
        removed: ['member'],
      }),
    ).toBe(true);
    expect(
      GroupMailboxRoster.of({
        adminIds: ['admin', 'second'],
        creatorId: 'creator',
        participantIds: ['admin', 'creator', 'second'],
      }).allowsCommit({ added: [], committer: 'admin', removed: ['second'] }),
    ).toBe(false);
  });

  it('never lets anyone remove the creator', () => {
    expect(
      managed.allowsCommit({
        added: [],
        committer: 'admin',
        removed: ['creator'],
      }),
    ).toBe(false);
  });

  it('lets the creator remove an admin', () => {
    expect(
      managed.allowsCommit({
        added: [],
        committer: 'creator',
        removed: ['admin'],
      }),
    ).toBe(true);
  });

  it('lets any manager remove an identity already off the roster', () => {
    expect(
      managed.allowsCommit({
        added: [],
        committer: 'admin',
        removed: ['outsider'],
      }),
    ).toBe(true);
  });

  it('rejects any commit by an identity off the roster', () => {
    expect(
      managed.allowsCommit({
        added: [],
        committer: 'outsider',
        removed: [],
      }),
    ).toBe(false);
  });

  it('lets any member rotate their own leaf', () => {
    expect(
      managed.allowsCommit({ added: [], committer: 'member', removed: [] }),
    ).toBe(true);
  });

  it('lets any member add or remove devices of its own identity', () => {
    expect(
      managed.allowsCommit({
        added: ['member'],
        committer: 'member',
        removed: ['member'],
      }),
    ).toBe(true);
    expect(
      managed.allowsCommit({
        added: [],
        committer: 'creator',
        removed: ['creator'],
      }),
    ).toBe(true);
  });

  it('rejects a commit that changes another identity next to its own devices', () => {
    expect(
      managed.allowsCommit({
        added: ['member', 'other'],
        committer: 'member',
        removed: [],
      }),
    ).toBe(false);
    expect(
      managed.allowsCommit({
        added: ['member'],
        committer: 'outsider',
        removed: [],
      }),
    ).toBe(false);
  });

  it('ignores an admin who left when naming the managers', () => {
    expect(managed.committers(['gone-admin', 'member'])).toEqual([]);
  });

  it('lets every member manage a roster without creator or admins, but not remove a member', () => {
    expect(
      unmanaged.allowsCommit({
        added: ['other'],
        committer: 'member',
        removed: [],
      }),
    ).toBe(true);
    expect(
      unmanaged.allowsCommit({
        added: [],
        committer: 'member',
        removed: ['other'],
      }),
    ).toBe(false);
  });

  it('names the leaf holders who may change membership, sorted', () => {
    expect(
      managed.committers(['member', 'creator', 'admin', 'creator']),
    ).toEqual(['admin', 'creator']);
    expect(unmanaged.committers(['other', 'member', 'outsider'])).toEqual([
      'member',
      'other',
    ]);
  });

  it('admits nobody when empty', () => {
    expect(GroupMailboxRoster.empty().has('member')).toBe(false);
    expect(
      GroupMailboxRoster.empty().allowsCommit({
        added: [],
        committer: 'member',
        removed: [],
      }),
    ).toBe(false);
  });

  it('ranks a removal above every commit of the member it removes, a removal of its own devices included', () => {
    const removal = rankOf('admin', ['member']);

    expect(removal).toBeGreaterThan(rankOf('member'));
    expect(removal).toBeGreaterThan(rankOf('member', ['member']));
  });

  it('ranks a commit by the creator above one by an admin, a removal included', () => {
    expect(rankOf('creator')).toBeGreaterThan(rankOf('admin'));
    expect(rankOf('creator')).toBeGreaterThan(rankOf('admin', ['member']));
  });

  it('settles a mutual removal by who may remove whom', () => {
    // Only the creator may remove an admin; nobody may remove the creator.
    expect(rankOf('creator', ['admin'])).toBeGreaterThan(
      rankOf('admin', ['creator']),
    );
  });

  it('ranks alike, leaving the commit id to decide, commits that remove nobody else by anyone but the creator, and any two by the creator', () => {
    expect(rankOf('admin')).toBe(rankOf('member'));
    expect(rankOf('member', ['member'])).toBe(rankOf('other'));
    expect(rankOf('creator', ['admin'])).toBe(rankOf('creator'));
  });
});
