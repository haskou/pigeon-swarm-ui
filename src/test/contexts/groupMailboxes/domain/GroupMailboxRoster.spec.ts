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
});
