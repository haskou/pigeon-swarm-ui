import type {
  Community,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ListCommunitiesPort } from '../ports/ListCommunitiesPort';

import { ListCommunities } from './ListCommunities';
import { ListCommunitiesMessage } from './messages/ListCommunitiesMessage';

describe(ListCommunities.name, () => {
  it('lists communities for the session carried by the message', async () => {
    const community = {
      createdAt: 1,
      description: 'DDD community',
      id: 'community-1',
      memberIds: ['identity-1'],
      name: 'Architecture',
      networkId: 'network-1',
      ownerIdentityId: 'identity-1',
      textChannels: [],
      visibility: 'private',
    } satisfies Community;
    const port: ListCommunitiesPort = {
      list: jest.fn().mockResolvedValue([community]),
    };
    const session = { identity: { id: 'identity-1' } } as Session;
    const message = new ListCommunitiesMessage(session);

    await expect(new ListCommunities(port).list(message)).resolves.toEqual([
      community,
    ]);

    expect(port.list).toHaveBeenCalledWith(message);
    expect(message.getSession()).toBe(session);
  });
});
