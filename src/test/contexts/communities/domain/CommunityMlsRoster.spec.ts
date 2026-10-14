import { CommunityMlsRoster } from '../../../../contexts/communities/domain/CommunityMlsRoster';

describe('CommunityMlsRoster', () => {
  const roster = CommunityMlsRoster.of({
    bannedMemberIds: ['banned'],
    memberIds: ['owner', 'moderator', 'helper', 'member', 'other', 'banned'],
    memberRoles: [
      { identityId: 'moderator', roleIds: ['moderators'] },
      { identityId: 'helper', roleIds: ['helpers'] },
    ],
    ownerIdentityId: 'owner',
    roles: [
      { id: 'everyone', permissions: ['send_messages'] },
      { id: 'moderators', permissions: ['manage_members'] },
      { id: 'helpers', permissions: ['ban_members', 'approve_members'] },
    ],
  });
  const commit = (
    committer: string,
    added: string[] = [],
    removed: string[] = [],
  ): boolean => roster.allowsCommit({ added, committer, removed });

  it('lets only the owner and members who may kick add members', () => {
    expect(commit('owner', ['member'])).toBe(true);
    expect(commit('moderator', ['member'])).toBe(true);
    expect(commit('helper', ['member'])).toBe(false);
    expect(commit('member', ['other'])).toBe(false);
  });

  it('never adds an identity that is not a member, or is banned', () => {
    expect(commit('owner', ['stranger'])).toBe(false);
    expect(commit('owner', ['banned'])).toBe(false);
  });

  it('lets any member remove an identity the roster no longer has', () => {
    expect(commit('member', [], ['stranger'])).toBe(true);
    expect(commit('member', [], ['banned'])).toBe(true);
  });

  it('lets only a manager remove a member still on the roster', () => {
    expect(commit('member', [], ['other'])).toBe(false);
    expect(commit('helper', [], ['other'])).toBe(false);
    expect(commit('moderator', [], ['other'])).toBe(true);
  });

  it('never removes the owner', () => {
    expect(commit('moderator', [], ['owner'])).toBe(false);
    expect(commit('owner', [], ['owner'])).toBe(false);
  });

  it('rejects any commit from outside the roster, even a rotation', () => {
    expect(commit('stranger')).toBe(false);
    expect(commit('banned', [], ['stranger'])).toBe(false);
    expect(commit('member')).toBe(true);
  });

  it('treats a manage_members everyone role as making every member a manager', () => {
    const open = CommunityMlsRoster.of({
      memberIds: ['owner', 'member'],
      ownerIdentityId: 'owner',
      roles: [{ id: 'everyone', permissions: ['manage_members'] }],
    });

    expect(open.manages('member')).toBe(true);
    expect(roster.manages('member')).toBe(false);
  });

  it('admits no one and lets no one commit when empty', () => {
    const empty = CommunityMlsRoster.empty();

    expect(empty.has('owner')).toBe(false);
    expect(
      empty.allowsCommit({ added: [], committer: 'owner', removed: [] }),
    ).toBe(false);
  });
});
