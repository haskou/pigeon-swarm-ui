import type { CommunityRepository } from '../../../../contexts/communities/domain/repositories/CommunityRepository';

import { CommunityRoleCreator } from '../../../../contexts/communities/application/create-community-role/CommunityRoleCreator';
import { CreateCommunityRoleMessage } from '../../../../contexts/communities/application/create-community-role/messages/CreateCommunityRoleMessage';
import { CommunityRoleRemover } from '../../../../contexts/communities/application/remove-community-role/CommunityRoleRemover';
import { RemoveCommunityRoleMessage } from '../../../../contexts/communities/application/remove-community-role/messages/RemoveCommunityRoleMessage';
import { CommunityRoleUpdater } from '../../../../contexts/communities/application/update-community-role/CommunityRoleUpdater';
import { UpdateCommunityRoleMessage } from '../../../../contexts/communities/application/update-community-role/messages/UpdateCommunityRoleMessage';
import { CommunityRole } from '../../../../contexts/communities/domain/entities/CommunityRole';
import { communityFixture, communityRepositoryMock } from '../CommunityFixture';

const role = (): CommunityRole =>
  CommunityRole.fromPrimitives({
    builtIn: false,
    id: 'new-role',
    name: 'New role',
    permissions: ['view_channels'],
  });

describe('community role use cases', () => {
  let communities: jest.Mocked<CommunityRepository>;

  beforeEach(() => {
    communities = communityRepositoryMock();
  });

  it('creates a role and adds it to the aggregate', async () => {
    const community = communityFixture();
    const created = role();

    communities.find.mockResolvedValue(community);
    communities.createRole.mockResolvedValue(created);

    await expect(
      new CommunityRoleCreator(communities).create(
        new CreateCommunityRoleMessage(
          'community-a',
          'New role',
          ['view_channels'],
          'owner-a',
          200,
        ),
      ),
    ).resolves.toBe(created);
  });

  it('updates an existing role', async () => {
    const community = communityFixture();
    const updated = role();

    communities.find.mockResolvedValue(community);
    communities.updateRole.mockResolvedValue(updated);

    await new CommunityRoleUpdater(communities).update(
      new UpdateCommunityRoleMessage(
        'community-a',
        'member-role',
        'Updated',
        ['view_channels'],
        'owner-a',
        200,
      ),
    );

    expect(communities.updateRole).toHaveBeenCalled();
  });

  it('removes an existing role', async () => {
    const community = communityFixture();

    communities.find.mockResolvedValue(community);

    await new CommunityRoleRemover(communities).remove(
      new RemoveCommunityRoleMessage(
        'community-a',
        'member-role',
        'owner-a',
        200,
      ),
    );

    expect(communities.deleteRole).toHaveBeenCalled();
  });
});
