import type { CommunityChannelResource } from '../../application/resources/CommunityChannelResource';
import type { CommunityResource } from '../../application/resources/CommunityResource';

import { Community } from '../../domain/Community';

export class CommunityMapper {
  private orderedChannels(
    resource: CommunityResource,
  ): CommunityChannelResource[] {
    const currentChannels = [
      ...resource.textChannels,
      ...(resource.voiceChannels ?? []),
    ];

    if (!resource.channels) return currentChannels;

    const currentById = new Map(
      currentChannels.map((channel) => [channel.id, channel]),
    );
    const ordered = resource.channels.flatMap((channel) => {
      const current = currentById.get(channel.id);

      if (!current) return [];

      currentById.delete(channel.id);

      return [current];
    });

    return [...ordered, ...currentById.values()];
  }

  public fromResource(resource: CommunityResource): Community {
    const assignedRoles = new Map(
      (resource.memberRoles ?? []).map((assignment) => [
        assignment.identityId,
        assignment.roleIds,
      ]),
    );
    const bannedMemberIds = new Set(resource.bannedMemberIds ?? []);
    const memberIds = new Set([
      ...resource.memberIds,
      ...bannedMemberIds,
      ...assignedRoles.keys(),
    ]);

    return Community.fromPrimitives({
      channels: this.orderedChannels(resource).map((channel) => ({
        connectedIdentityIds:
          channel.type === 'voice' ? (channel.connectedIdentityIds ?? []) : [],
        createdAt: channel.createdAt,
        id: channel.id,
        name: channel.name,
        type: channel.type,
        visibleRoleIds: channel.permissions?.visibleRoleIds ?? [],
      })),
      members: [...memberIds].map((identityId) => ({
        banned: bannedMemberIds.has(identityId),
        identityId,
        roleIds: assignedRoles.get(identityId) ?? [],
      })),
      metadata: {
        createdAt: resource.createdAt,
        id: resource.id,
        networkId: resource.networkId,
        ownerIdentityId: resource.ownerIdentityId,
      },
      profile: {
        avatar: resource.avatar ?? undefined,
        banner: resource.banner ?? undefined,
        description: resource.description,
        name: resource.name,
      },
      publication: {
        autoJoinEnabled: resource.autoJoinEnabled ?? false,
        discoverable: resource.discoverable ?? true,
        visibility: resource.visibility,
      },
      roles: (resource.roles ?? []).map((role) => ({
        builtIn: role.builtIn ?? false,
        id: role.id,
        name: role.name,
        permissions: role.permissions,
      })),
    });
  }

  public toResource(community: Community): CommunityResource {
    const primitives = community.toPrimitives();
    const channels: CommunityChannelResource[] = primitives.channels.map(
      (channel) =>
        channel.type === 'voice'
          ? {
              connectedIdentityIds: channel.connectedIdentityIds,
              createdAt: channel.createdAt,
              id: channel.id,
              name: channel.name,
              permissions: { visibleRoleIds: channel.visibleRoleIds },
              type: 'voice',
            }
          : {
              createdAt: channel.createdAt,
              id: channel.id,
              name: channel.name,
              permissions: { visibleRoleIds: channel.visibleRoleIds },
              type: 'text',
            },
    );

    return {
      autoJoinEnabled: primitives.publication.autoJoinEnabled,
      avatar: primitives.profile.avatar,
      bannedMemberIds: primitives.members
        .filter((member) => member.banned)
        .map((member) => member.identityId),
      banner: primitives.profile.banner,
      channels,
      createdAt: primitives.metadata.createdAt,
      description: primitives.profile.description,
      discoverable: primitives.publication.discoverable,
      id: primitives.metadata.id,
      memberIds: primitives.members
        .filter((member) => !member.banned)
        .map((member) => member.identityId),
      memberRoles: primitives.members.map((member) => ({
        identityId: member.identityId,
        roleIds: member.roleIds,
      })),
      name: primitives.profile.name,
      networkId: primitives.metadata.networkId,
      ownerIdentityId: primitives.metadata.ownerIdentityId,
      roles: primitives.roles,
      textChannels: channels.filter((channel) => channel.type === 'text'),
      visibility: primitives.publication.visibility,
      voiceChannels: channels.filter((channel) => channel.type === 'voice'),
    };
  }
}
