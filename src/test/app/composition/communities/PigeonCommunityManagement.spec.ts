import { mock } from 'jest-mock-extended';

import type { CommunityManagementUseCases } from '../../../../app/composition/communities/CommunityManagementUseCases';
import type { CommunitiesSearcher } from '../../../../contexts/communities/application/search-communities/CommunitiesSearcher';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { PigeonCommunityManagement } from '../../../../app/composition/communities/PigeonCommunityManagement';
import { SearchCommunitiesMessage } from '../../../../contexts/communities/application/search-communities/messages/SearchCommunitiesMessage';
import { CommunityAccessContexts } from '../../../../contexts/communities/infrastructure/http/CommunityAccessContexts';
import { CommunityMapper } from '../../../../contexts/communities/infrastructure/http/CommunityMapper';

describe(PigeonCommunityManagement.name, () => {
  it('searches the communities of the session with the abort signal of the read', async () => {
    const searcher = mock<CommunitiesSearcher>();
    const session = { identity: { id: 'owner-a' } } as Session;
    const { signal } = new AbortController();
    const management = new PigeonCommunityManagement(
      new CommunityAccessContexts(),
      new CommunityMapper(),
      mock<CommunityManagementUseCases>({ searcher }),
    );

    searcher.search.mockResolvedValue([]);

    await expect(management.search(session, { signal })).resolves.toEqual([]);
    expect(searcher.search).toHaveBeenCalledWith(
      expect.any(SearchCommunitiesMessage),
      { signal },
    );
  });
});
