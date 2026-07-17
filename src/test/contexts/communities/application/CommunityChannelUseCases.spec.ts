import type { CommunityRepository } from '../../../../contexts/communities/domain/repositories/CommunityRepository';

import { CommunityChannelCreator } from '../../../../contexts/communities/application/create-community-channel/CommunityChannelCreator';
import { CreateCommunityChannelMessage } from '../../../../contexts/communities/application/create-community-channel/messages/CreateCommunityChannelMessage';
import { CommunityChannelRemover } from '../../../../contexts/communities/application/remove-community-channel/CommunityChannelRemover';
import { RemoveCommunityChannelMessage } from '../../../../contexts/communities/application/remove-community-channel/messages/RemoveCommunityChannelMessage';
import { CommunityChannelRenamer } from '../../../../contexts/communities/application/rename-community-channel/CommunityChannelRenamer';
import { RenameCommunityChannelMessage } from '../../../../contexts/communities/application/rename-community-channel/messages/RenameCommunityChannelMessage';
import { CommunityChannelPermissionsUpdater } from '../../../../contexts/communities/application/update-community-channel-permissions/CommunityChannelPermissionsUpdater';
import { UpdateCommunityChannelPermissionsMessage } from '../../../../contexts/communities/application/update-community-channel-permissions/messages/UpdateCommunityChannelPermissionsMessage';
import { CommunityChannel } from '../../../../contexts/communities/domain/entities/CommunityChannel';
import { communityFixture, communityRepositoryMock } from '../CommunityFixture';

const channel = (): CommunityChannel =>
  CommunityChannel.fromPrimitives({
    connectedIdentityIds: [],
    createdAt: 200,
    id: 'channel-created',
    name: 'created',
    type: 'text',
    visibleRoleIds: ['everyone'],
  });

describe('community channel use cases', () => {
  let communities: jest.Mocked<CommunityRepository>;

  beforeEach(() => {
    communities = communityRepositoryMock();
  });

  it.each(['text', 'voice'])('creates a %s channel', async (type) => {
    const community = communityFixture();
    const created = channel();

    communities.find.mockResolvedValue(community);
    communities.createTextChannel.mockResolvedValue(created);
    communities.createVoiceChannel.mockResolvedValue(created);

    await expect(
      new CommunityChannelCreator(communities).create(
        new CreateCommunityChannelMessage(
          'community-a',
          'created',
          type,
          'owner-a',
          200,
        ),
      ),
    ).resolves.toBe(created);
  });

  it('renames an existing channel', async () => {
    const community = communityFixture();
    const renamed = channel();

    communities.find.mockResolvedValue(community);
    communities.renameChannel.mockResolvedValue(renamed);

    await new CommunityChannelRenamer(communities).rename(
      new RenameCommunityChannelMessage(
        'community-a',
        'channel-a',
        'renamed',
        'owner-a',
        200,
      ),
    );

    expect(communities.renameChannel).toHaveBeenCalled();
  });

  it('removes an existing channel', async () => {
    const community = communityFixture();

    communities.find.mockResolvedValue(community);
    communities.deleteChannel.mockResolvedValue(community);

    await new CommunityChannelRemover(communities).remove(
      new RemoveCommunityChannelMessage(
        'community-a',
        'channel-a',
        'owner-a',
        200,
      ),
    );

    expect(communities.deleteChannel).toHaveBeenCalled();
  });

  it('updates visible roles through the aggregate', async () => {
    const community = communityFixture();
    const updated = channel();

    communities.find.mockResolvedValue(community);
    communities.restrictChannel.mockResolvedValue(updated);

    await new CommunityChannelPermissionsUpdater(communities).update(
      new UpdateCommunityChannelPermissionsMessage(
        'community-a',
        'channel-a',
        ['member-role'],
        'owner-a',
        200,
      ),
    );

    expect(communities.restrictChannel).toHaveBeenCalled();
  });
});
