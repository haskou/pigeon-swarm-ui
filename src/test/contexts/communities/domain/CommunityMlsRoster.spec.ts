import { CommunityMlsRoster } from '../../../../contexts/communities/domain/CommunityMlsRoster';
import { CommunityOperationHistory } from '../infrastructure/http/CommunityOperationHistory';
import { MlsTestIdentity } from '../infrastructure/mls/MlsTestIdentity';

describe('CommunityMlsRoster', () => {
  let cast: Record<string, MlsTestIdentity>;
  let roster: CommunityMlsRoster;
  const id = (name: string): string => cast[name].id;
  const commitTo = (
    to: CommunityMlsRoster,
    committer: string,
    added: string[] = [],
    removed: string[] = [],
  ): boolean =>
    to.allowsCommit({
      added: added.map(id),
      committer: id(committer),
      removed: removed.map(id),
    });
  const commit = (
    committer: string,
    added: string[] = [],
    removed: string[] = [],
  ): boolean => commitTo(roster, committer, added, removed);

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

  describe('of a restricted channel', () => {
    let history: CommunityOperationHistory;
    let channelId: string;
    let moderators: string;
    let viewers: string;
    const channel = (): CommunityMlsRoster =>
      CommunityMlsRoster.replay(history.operations(), channelId);

    beforeEach(() => {
      const { member, moderator, owner } = cast;

      history = new CommunityOperationHistory(owner);
      moderators = history.createRole(owner, ['manage_members']);
      viewers = history.createRole(owner, []);

      for (const name of ['moderator', 'member', 'other']) {
        history.add(owner, cast[name]);
      }

      history.assign(owner, moderator, [moderators]);
      history.assign(owner, member, [viewers]);
      channelId = history.createChannel(owner);
      history.restrictChannel(owner, channelId, [viewers]);
    });

    it('holds only the owner and the members a visible role lets in', () => {
      expect(channel().participants().sort()).toEqual(
        [id('owner'), id('member')].sort(),
      );
      expect(channel().has(id('moderator'))).toBe(false);
      expect(channel().manages(id('moderator'))).toBe(false);
      expect(commitTo(channel(), 'owner', ['other'])).toBe(false);
      expect(commitTo(channel(), 'owner', ['member'])).toBe(true);
    });

    it('lets a community manager manage it only while it may see the channel', () => {
      history.assign(cast.owner, cast.moderator, [moderators, viewers]);

      expect(channel().manages(id('moderator'))).toBe(true);
      expect(channel().manages(id('member'))).toBe(false);
    });

    it('lets any member remove one who lost the role', () => {
      history.assign(cast.owner, cast.member, []);

      expect(channel().has(id('member'))).toBe(false);
      expect(commitTo(channel(), 'owner', [], ['member'])).toBe(true);
    });

    it('ignores a grant the node forges', () => {
      history.append(
        cast.owner,
        'member_roles_updated',
        { identityId: id('other'), roleIds: [viewers] },
        cast.stranger.keyPair,
      );

      expect(channel().has(id('other'))).toBe(false);
    });

    it('admits no one to a channel the signed history lacks or deleted', () => {
      expect(
        CommunityMlsRoster.replay(history.operations(), 'missing').has(
          id('owner'),
        ),
      ).toBe(false);

      history.append(cast.owner, 'channel_deleted', { channelId });

      expect(channel().participants()).toEqual([]);
    });

    it('leaves the community roster whole', () => {
      expect(
        CommunityMlsRoster.replay(history.operations()).has(id('other')),
      ).toBe(true);
    });
  });
});
