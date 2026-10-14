import { CommunityMlsRoster } from '../../../../contexts/communities/domain/CommunityMlsRoster';
import { CommunityOperationHistory } from '../infrastructure/http/CommunityOperationHistory';
import { MlsTestIdentity } from '../infrastructure/mls/MlsTestIdentity';

describe('CommunityMlsRoster', () => {
  let cast: Record<string, MlsTestIdentity>;
  let roster: CommunityMlsRoster;
  const id = (name: string): string => cast[name].id;
  const commit = (
    committer: string,
    added: string[] = [],
    removed: string[] = [],
  ): boolean =>
    roster.allowsCommit({
      added: added.map(id),
      committer: id(committer),
      removed: removed.map(id),
    });

  beforeAll(async () => {
    cast = await MlsTestIdentity.cast([
      'owner',
      'moderator',
      'helper',
      'member',
      'other',
      'banned',
      'stranger',
    ]);
    const { banned, helper, moderator, owner } = cast;
    const history = new CommunityOperationHistory(owner);
    const moderators = history.createRole(owner, ['manage_members']);
    const helpers = history.createRole(owner, [
      'ban_members',
      'approve_members',
    ]);

    for (const name of ['moderator', 'helper', 'member', 'other', 'banned']) {
      history.add(owner, cast[name]);
    }

    history.assign(owner, moderator, [moderators]);
    history.assign(owner, helper, [helpers]);
    history.append(owner, 'member_banned', { identityId: banned.id });
    roster = CommunityMlsRoster.replay(history.operations());
  });

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
    const { member, owner } = cast;
    const history = new CommunityOperationHistory(owner);

    history.add(owner, member);
    history.append(owner, 'role_updated', {
      name: 'everyone',
      permissions: ['manage_members'],
      roleId: 'everyone',
    });

    expect(
      CommunityMlsRoster.replay(history.operations()).manages(member.id),
    ).toBe(true);
    expect(roster.manages(member.id)).toBe(false);
  });

  it('admits no one when the operations prove no community', () => {
    const { owner } = cast;
    const history = new CommunityOperationHistory(owner);

    history.add(owner, cast.member);
    const empty = CommunityMlsRoster.replay(history.operations().slice(1));

    expect(empty.has(owner.id)).toBe(false);
    expect(
      empty.allowsCommit({ added: [], committer: owner.id, removed: [] }),
    ).toBe(false);
  });

  it('admits no one and lets no one commit when empty', () => {
    const empty = CommunityMlsRoster.empty();

    expect(empty.has(id('owner'))).toBe(false);
    expect(
      empty.allowsCommit({ added: [], committer: id('owner'), removed: [] }),
    ).toBe(false);
  });
});
