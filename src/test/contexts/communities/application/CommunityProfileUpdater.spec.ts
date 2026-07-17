import { CommunityProfileUpdater } from '../../../../contexts/communities/application/update-community-profile/CommunityProfileUpdater';
import { UpdateCommunityProfileMessage } from '../../../../contexts/communities/application/update-community-profile/messages/UpdateCommunityProfileMessage';
import { communityFixture, communityRepositoryMock } from '../CommunityFixture';

describe(CommunityProfileUpdater.name, () => {
  it('updates profile values through the aggregate', async () => {
    const communities = communityRepositoryMock();
    const community = communityFixture();

    communities.find.mockResolvedValue(community);
    communities.updateProfile.mockResolvedValue(community);

    await new CommunityProfileUpdater(communities).update(
      new UpdateCommunityProfileMessage(
        'community-a',
        'owner-a',
        'Updated',
        'Updated description',
        'avatar-cid',
        'banner-cid',
        200,
      ),
    );

    expect(communities.updateProfile).toHaveBeenCalledWith(
      community,
      expect.anything(),
    );
  });
});
