import type { CommunityRepository } from '../../../../contexts/communities/domain/repositories/CommunityRepository';

import { CommunityFinder } from '../../../../contexts/communities/application/find-community/CommunityFinder';
import { FindCommunityMessage } from '../../../../contexts/communities/application/find-community/messages/FindCommunityMessage';
import { CommunitiesSearcher } from '../../../../contexts/communities/application/search-communities/CommunitiesSearcher';
import { SearchCommunitiesMessage } from '../../../../contexts/communities/application/search-communities/messages/SearchCommunitiesMessage';
import { communityFixture, communityRepositoryMock } from '../CommunityFixture';

describe('community directory use cases', () => {
  let communities: jest.Mocked<CommunityRepository>;

  beforeEach(() => {
    communities = communityRepositoryMock();
  });

  it('finds one community through its repository', async () => {
    const community = communityFixture();

    communities.find.mockResolvedValue(community);

    await expect(
      new CommunityFinder(communities).find(
        new FindCommunityMessage('community-a', 'owner-a'),
      ),
    ).resolves.toBe(community);
  });

  it('searches communities for the acting identity', async () => {
    const community = communityFixture();

    communities.search.mockResolvedValue([community]);

    await expect(
      new CommunitiesSearcher(communities).search(
        new SearchCommunitiesMessage('owner-a'),
      ),
    ).resolves.toEqual([community]);
  });
});
