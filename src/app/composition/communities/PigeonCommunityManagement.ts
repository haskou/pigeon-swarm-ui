import type { CommunityChannel } from '../../../contexts/communities/domain/entities/CommunityChannel';
import type { CommunityRole } from '../../../contexts/communities/domain/entities/CommunityRole';
import type { CommunityTextChannelResource } from '../../../contexts/communities/infrastructure/http/resources/CommunityTextChannelResource';
import type { CommunityVoiceChannelResource } from '../../../contexts/communities/infrastructure/http/resources/CommunityVoiceChannelResource';
import type {
  Community,
  CommunityChannel as CommunityChannelResource,
  CommunityPermission,
  CommunityRoleResource,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { CommunityManagementUseCases } from './CommunityManagementUseCases';

import { AssignCommunityMemberRolesMessage } from '../../../contexts/communities/application/assign-community-member-roles/messages/AssignCommunityMemberRolesMessage';
import { BanCommunityMemberMessage } from '../../../contexts/communities/application/ban-community-member/messages/BanCommunityMemberMessage';
import { CreateCommunityChannelMessage } from '../../../contexts/communities/application/create-community-channel/messages/CreateCommunityChannelMessage';
import { CreateCommunityRoleMessage } from '../../../contexts/communities/application/create-community-role/messages/CreateCommunityRoleMessage';
import { FindCommunityMessage } from '../../../contexts/communities/application/find-community/messages/FindCommunityMessage';
import { KickCommunityMemberMessage } from '../../../contexts/communities/application/kick-community-member/messages/KickCommunityMemberMessage';
import { RemoveCommunityChannelMessage } from '../../../contexts/communities/application/remove-community-channel/messages/RemoveCommunityChannelMessage';
import { RemoveCommunityRoleMessage } from '../../../contexts/communities/application/remove-community-role/messages/RemoveCommunityRoleMessage';
import { RenameCommunityChannelMessage } from '../../../contexts/communities/application/rename-community-channel/messages/RenameCommunityChannelMessage';
import { SearchCommunitiesMessage } from '../../../contexts/communities/application/search-communities/messages/SearchCommunitiesMessage';
import { UnbanCommunityMemberMessage } from '../../../contexts/communities/application/unban-community-member/messages/UnbanCommunityMemberMessage';
import { UpdateCommunityChannelPermissionsMessage } from '../../../contexts/communities/application/update-community-channel-permissions/messages/UpdateCommunityChannelPermissionsMessage';
import { UpdateCommunityRoleMessage } from '../../../contexts/communities/application/update-community-role/messages/UpdateCommunityRoleMessage';
import { CommunityAccessContexts } from '../../../contexts/communities/infrastructure/http/CommunityAccessContexts';
import { CommunityMapper } from '../../../contexts/communities/infrastructure/http/CommunityMapper';

export class PigeonCommunityManagement {
  public constructor(
    private readonly contexts: CommunityAccessContexts,
    private readonly mapper: CommunityMapper,
    private readonly useCases: CommunityManagementUseCases,
  ) {}

  private actor(session: Session): string {
    this.contexts.register(session);

    return session.identity.id;
  }

  private channelResource(channel: CommunityChannel): CommunityChannelResource {
    return this.mapper.toChannelResource(channel.toPrimitives());
  }

  private roleResource(role: CommunityRole): CommunityRoleResource {
    return role.toPrimitives();
  }

  public async assignMemberRoles(
    session: Session,
    communityId: string,
    identityId: string,
    roleIds: string[],
  ): Promise<Community> {
    const community = await this.useCases.assigner.assign(
      new AssignCommunityMemberRolesMessage(
        communityId,
        identityId,
        roleIds,
        this.actor(session),
        Date.now(),
      ),
    );

    return this.mapper.toResource(community);
  }

  public async banMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    const community = await this.useCases.banner.ban(
      new BanCommunityMemberMessage(
        communityId,
        identityId,
        this.actor(session),
        Date.now(),
      ),
    );

    return this.mapper.toResource(community);
  }

  public async createChannel(
    session: Session,
    communityId: string,
    name: string,
    type: 'text',
  ): Promise<CommunityTextChannelResource>;

  public async createChannel(
    session: Session,
    communityId: string,
    name: string,
    type: 'voice',
  ): Promise<CommunityVoiceChannelResource>;

  public async createChannel(
    session: Session,
    communityId: string,
    name: string,
    type: 'text' | 'voice',
  ): Promise<CommunityChannelResource> {
    const channel = await this.useCases.channelCreator.create(
      new CreateCommunityChannelMessage(
        communityId,
        name,
        type,
        this.actor(session),
        Date.now(),
      ),
    );

    return this.channelResource(channel);
  }

  public async createRole(
    session: Session,
    communityId: string,
    name: string,
    permissions: CommunityPermission[],
  ): Promise<CommunityRoleResource> {
    const role = await this.useCases.roleCreator.create(
      new CreateCommunityRoleMessage(
        communityId,
        name,
        permissions,
        this.actor(session),
        Date.now(),
      ),
    );

    return this.roleResource(role);
  }

  public async deleteChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<Community> {
    const community = await this.useCases.channelRemover.remove(
      new RemoveCommunityChannelMessage(
        communityId,
        channelId,
        this.actor(session),
        Date.now(),
      ),
    );

    return this.mapper.toResource(community);
  }

  public async deleteRole(
    session: Session,
    communityId: string,
    roleId: string,
  ): Promise<void> {
    await this.useCases.roleRemover.remove(
      new RemoveCommunityRoleMessage(
        communityId,
        roleId,
        this.actor(session),
        Date.now(),
      ),
    );
  }

  public async find(session: Session, communityId: string): Promise<Community> {
    const community = await this.useCases.finder.find(
      new FindCommunityMessage(communityId, this.actor(session)),
    );

    return this.mapper.toResource(community);
  }

  public async kickMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    const community = await this.useCases.kicker.kick(
      new KickCommunityMemberMessage(
        communityId,
        identityId,
        this.actor(session),
        Date.now(),
      ),
    );

    return this.mapper.toResource(community);
  }

  public async renameChannel(
    session: Session,
    communityId: string,
    channelId: string,
    name: string,
  ): Promise<CommunityChannelResource> {
    const channel = await this.useCases.channelRenamer.rename(
      new RenameCommunityChannelMessage(
        communityId,
        channelId,
        name,
        this.actor(session),
        Date.now(),
      ),
    );

    return this.channelResource(channel);
  }

  public async search(session: Session): Promise<Community[]> {
    const communities = await this.useCases.searcher.search(
      new SearchCommunitiesMessage(this.actor(session)),
    );

    return communities.map((community) => this.mapper.toResource(community));
  }

  public async unbanMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    const community = await this.useCases.unbanner.unban(
      new UnbanCommunityMemberMessage(
        communityId,
        identityId,
        this.actor(session),
        Date.now(),
      ),
    );

    return this.mapper.toResource(community);
  }

  public async updateChannelPermissions(
    session: Session,
    communityId: string,
    channelId: string,
    visibleRoleIds: string[],
  ): Promise<CommunityChannelResource> {
    const channel = await this.useCases.permissionsUpdater.update(
      new UpdateCommunityChannelPermissionsMessage(
        communityId,
        channelId,
        visibleRoleIds,
        this.actor(session),
        Date.now(),
      ),
    );

    return this.channelResource(channel);
  }

  public async updateRole(
    session: Session,
    communityId: string,
    roleId: string,
    name: string,
    permissions: CommunityPermission[],
  ): Promise<CommunityRoleResource> {
    const role = await this.useCases.roleUpdater.update(
      new UpdateCommunityRoleMessage(
        communityId,
        roleId,
        name,
        permissions,
        this.actor(session),
        Date.now(),
      ),
    );

    return this.roleResource(role);
  }
}
