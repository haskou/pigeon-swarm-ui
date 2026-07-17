import type { CommunityRepository } from '../../../../contexts/communities/domain/repositories/CommunityRepository';

import { CommunityMemberRolesAssigner } from '../../../../contexts/communities/application/assign-community-member-roles/CommunityMemberRolesAssigner';
import { AssignCommunityMemberRolesMessage } from '../../../../contexts/communities/application/assign-community-member-roles/messages/AssignCommunityMemberRolesMessage';
import { CommunityMemberBanner } from '../../../../contexts/communities/application/ban-community-member/CommunityMemberBanner';
import { BanCommunityMemberMessage } from '../../../../contexts/communities/application/ban-community-member/messages/BanCommunityMemberMessage';
import { CommunityMemberKicker } from '../../../../contexts/communities/application/kick-community-member/CommunityMemberKicker';
import { KickCommunityMemberMessage } from '../../../../contexts/communities/application/kick-community-member/messages/KickCommunityMemberMessage';
import { CommunityMemberUnbanner } from '../../../../contexts/communities/application/unban-community-member/CommunityMemberUnbanner';
import { UnbanCommunityMemberMessage } from '../../../../contexts/communities/application/unban-community-member/messages/UnbanCommunityMemberMessage';
import { communityFixture, communityRepositoryMock } from '../CommunityFixture';

describe('community member use cases', () => {
  let communities: jest.Mocked<CommunityRepository>;

  beforeEach(() => {
    communities = communityRepositoryMock();
  });

  it('bans a member through the aggregate', async () => {
    const community = communityFixture();

    communities.find.mockResolvedValue(community);
    communities.banMember.mockResolvedValue(community);

    await new CommunityMemberBanner(communities).ban(
      new BanCommunityMemberMessage('community-a', 'member-a', 'owner-a', 200),
    );

    expect(communities.banMember).toHaveBeenCalledWith(
      community,
      expect.anything(),
      expect.anything(),
    );
  });

  it('unbans a member through the aggregate', async () => {
    const community = communityFixture();

    community.banMember(
      new BanCommunityMemberMessage(
        'community-a',
        'member-a',
        'owner-a',
        100,
      ).getMemberIdentityId(),
      new BanCommunityMemberMessage(
        'community-a',
        'member-a',
        'owner-a',
        100,
      ).getOccurredAt(),
    );
    communities.find.mockResolvedValue(community);
    communities.unbanMember.mockResolvedValue(community);

    await new CommunityMemberUnbanner(communities).unban(
      new UnbanCommunityMemberMessage(
        'community-a',
        'member-a',
        'owner-a',
        200,
      ),
    );

    expect(communities.unbanMember).toHaveBeenCalled();
  });

  it('kicks a member through the aggregate', async () => {
    const community = communityFixture();

    communities.find.mockResolvedValue(community);
    communities.kickMember.mockResolvedValue(community);

    await new CommunityMemberKicker(communities).kick(
      new KickCommunityMemberMessage('community-a', 'member-a', 'owner-a', 200),
    );

    expect(communities.kickMember).toHaveBeenCalled();
  });

  it('assigns only roles owned by the community', async () => {
    const community = communityFixture();

    communities.find.mockResolvedValue(community);
    communities.assignMemberRoles.mockResolvedValue(community);

    await new CommunityMemberRolesAssigner(communities).assign(
      new AssignCommunityMemberRolesMessage(
        'community-a',
        'member-a',
        ['member-role'],
        'owner-a',
        200,
      ),
    );

    expect(communities.assignMemberRoles).toHaveBeenCalled();
  });
});
