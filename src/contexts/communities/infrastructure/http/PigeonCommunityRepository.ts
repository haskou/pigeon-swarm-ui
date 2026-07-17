import type { CommunityChannelResource } from '../../application/resources/CommunityChannelResource';
import type { Community } from '../../domain/Community';
import type { CommunityChannel } from '../../domain/entities/CommunityChannel';
import type { CommunityRole } from '../../domain/entities/CommunityRole';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';
import type { CommunityChannelId } from '../../domain/value-objects/CommunityChannelId';
import type { CommunityChannelName } from '../../domain/value-objects/CommunityChannelName';
import type { CommunityId } from '../../domain/value-objects/CommunityId';
import type { CommunityIdentityId } from '../../domain/value-objects/CommunityIdentityId';
import type { CommunityPermission } from '../../domain/value-objects/CommunityPermission';
import type { CommunityRoleId } from '../../domain/value-objects/CommunityRoleId';
import type { CommunityRoleName } from '../../domain/value-objects/CommunityRoleName';

import { CommunityChannel as CommunityChannelEntity } from '../../domain/entities/CommunityChannel';
import { CommunityRole as CommunityRoleEntity } from '../../domain/entities/CommunityRole';
import { CommunityAccessContexts } from './CommunityAccessContexts';
import { CommunityMapper } from './CommunityMapper';
import { PigeonCommunitiesGateway } from './PigeonCommunitiesGateway';

export class PigeonCommunityRepository implements CommunityRepository {
  public constructor(
    private readonly gateway: PigeonCommunitiesGateway,
    private readonly contexts: CommunityAccessContexts,
    private readonly mapper: CommunityMapper,
  ) {}

  private channelFromResource(
    resource: CommunityChannelResource,
  ): CommunityChannel {
    return CommunityChannelEntity.fromPrimitives({
      connectedIdentityIds:
        resource.type === 'voice' ? (resource.connectedIdentityIds ?? []) : [],
      createdAt: resource.createdAt,
      id: resource.id,
      name: resource.name,
      type: resource.type,
      visibleRoleIds: resource.permissions?.visibleRoleIds ?? [],
    });
  }

  public async assignMemberRoles(
    community: Community,
    memberIdentityId: CommunityIdentityId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community> {
    const resource = await this.gateway.assignCommunityMemberRoles(
      this.contexts.find(actorIdentityId),
      community.getId().toString(),
      memberIdentityId.toString(),
      community
        .getMemberRoleIds(memberIdentityId)
        .map((roleId) => roleId.toString()),
    );

    return this.mapper.fromResource(resource);
  }

  public async banMember(
    community: Community,
    memberIdentityId: CommunityIdentityId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community> {
    return this.mapper.fromResource(
      await this.gateway.banCommunityMember(
        this.contexts.find(actorIdentityId),
        community.getId().toString(),
        memberIdentityId.toString(),
      ),
    );
  }

  public async createRole(
    community: Community,
    name: CommunityRoleName,
    permissions: CommunityPermission[],
    actorIdentityId: CommunityIdentityId,
  ): Promise<CommunityRole> {
    const resource = await this.gateway.createCommunityRole(
      this.contexts.find(actorIdentityId),
      community.getId().toString(),
      {
        name: name.toString(),
        permissions: permissions.map((permission) => permission.valueOf()),
      },
    );

    return CommunityRoleEntity.fromPrimitives({
      builtIn: resource.builtIn ?? false,
      id: resource.id,
      name: resource.name,
      permissions: resource.permissions,
    });
  }

  public async createTextChannel(
    community: Community,
    name: CommunityChannelName,
    actorIdentityId: CommunityIdentityId,
  ): Promise<CommunityChannel> {
    const resource = await this.gateway.createCommunityTextChannel(
      this.contexts.find(actorIdentityId),
      community.getId().toString(),
      name.toString(),
    );

    return this.channelFromResource(resource);
  }

  public async createVoiceChannel(
    community: Community,
    name: CommunityChannelName,
    actorIdentityId: CommunityIdentityId,
  ): Promise<CommunityChannel> {
    const resource = await this.gateway.createCommunityVoiceChannel(
      this.contexts.find(actorIdentityId),
      community.getId().toString(),
      name.toString(),
    );

    return this.channelFromResource(resource);
  }

  public async deleteChannel(
    community: Community,
    channelId: CommunityChannelId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community> {
    return this.mapper.fromResource(
      await this.gateway.deleteCommunityChannel(
        this.contexts.find(actorIdentityId),
        community.getId().toString(),
        channelId.toString(),
      ),
    );
  }

  public async deleteRole(
    community: Community,
    roleId: CommunityRoleId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<void> {
    await this.gateway.deleteCommunityRole(
      this.contexts.find(actorIdentityId),
      community.getId().toString(),
      roleId.toString(),
    );
  }

  public async find(
    communityId: CommunityId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community> {
    return this.mapper.fromResource(
      await this.gateway.getCommunity(
        this.contexts.find(actorIdentityId),
        communityId.toString(),
      ),
    );
  }

  public async kickMember(
    community: Community,
    memberIdentityId: CommunityIdentityId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community> {
    return this.mapper.fromResource(
      await this.gateway.kickCommunityMember(
        this.contexts.find(actorIdentityId),
        community.getId().toString(),
        memberIdentityId.toString(),
      ),
    );
  }

  public async leave(
    community: Community,
    actorIdentityId: CommunityIdentityId,
  ): Promise<void> {
    await this.gateway.leaveCommunity(
      this.contexts.find(actorIdentityId),
      community.getId().toString(),
    );
  }

  public async renameChannel(
    community: Community,
    channelId: CommunityChannelId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<CommunityChannel> {
    const resource = await this.gateway.renameCommunityChannel(
      this.contexts.find(actorIdentityId),
      community.getId().toString(),
      channelId.toString(),
      community.getChannelName(channelId).toString(),
    );

    return this.channelFromResource(resource);
  }

  public async restrictChannel(
    community: Community,
    channelId: CommunityChannelId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<CommunityChannel> {
    const resource = await this.gateway.updateCommunityChannelPermissions(
      this.contexts.find(actorIdentityId),
      community.getId().toString(),
      channelId.toString(),
      community
        .getChannelVisibleRoleIds(channelId)
        .map((roleId) => roleId.toString()),
    );

    return this.channelFromResource(resource);
  }

  public async search(
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community[]> {
    const resources = await this.gateway.listCommunities(
      this.contexts.find(actorIdentityId),
    );

    return resources.map((resource) => this.mapper.fromResource(resource));
  }

  public async unbanMember(
    community: Community,
    memberIdentityId: CommunityIdentityId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community> {
    return this.mapper.fromResource(
      await this.gateway.unbanCommunityMember(
        this.contexts.find(actorIdentityId),
        community.getId().toString(),
        memberIdentityId.toString(),
      ),
    );
  }

  public async updateProfile(
    community: Community,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community> {
    const profile = this.mapper.toResource(community);
    const resource = await this.gateway.updateCommunity(
      this.contexts.find(actorIdentityId),
      community.getId().toString(),
      {
        autoJoinEnabled: profile.autoJoinEnabled,
        avatar: profile.avatar ?? undefined,
        banner: profile.banner ?? undefined,
        description: profile.description,
        discoverable: profile.discoverable,
        name: profile.name,
      },
    );

    return this.mapper.fromResource(resource);
  }

  public async updateRole(
    community: Community,
    roleId: CommunityRoleId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<CommunityRole> {
    const resource = await this.gateway.updateCommunityRole(
      this.contexts.find(actorIdentityId),
      community.getId().toString(),
      roleId.toString(),
      {
        name: community.getRoleName(roleId).toString(),
        permissions: community
          .getRolePermissions(roleId)
          .map((permission) => permission.valueOf()),
      },
    );

    return CommunityRoleEntity.fromPrimitives({
      builtIn: resource.builtIn ?? false,
      id: resource.id,
      name: resource.name,
      permissions: resource.permissions,
    });
  }
}
