/* eslint-disable @typescript-eslint/no-use-before-define */
import type { CommunityResource as Community } from '../../infrastructure/http/resources/CommunityResource';
import type { CommunityChannelResource as CommunityChannel } from '../../infrastructure/http/resources/CommunityChannelResource';
import type { CommunityPermissionResource as CommunityPermission } from '../../infrastructure/http/resources/CommunityPermissionResource';
import type { CommunityRoleResource } from '../../infrastructure/http/resources/CommunityRoleResource';

import { IdentityMatch } from '../../../identities/domain/IdentityMatch';

export const ALL_COMMUNITY_PERMISSIONS: CommunityPermission[] = [
  'view_channels',
  'manage_channels',
  'manage_roles',
  'manage_members',
  'create_invites',
  'approve_members',
  'reject_members',
  'ban_members',
  'send_messages',
  'embed_links',
  'attach_files',
  'send_stickers',
  'mention_everyone',
  'mention_here',
  'mention_roles',
  'manage_messages',
  'create_polls',
  'connect_voice',
];

export class CommunityAccessPolicy {
  public static assignedRoleIdsFor(
    community: Community,
    identityId: string,
  ): Set<string> {
    const roleIds = new Set<string>(['everyone']);
    const assignment = community.memberRoles?.find((memberRole) =>
      IdentityMatch.isSame(memberRole.identityId, identityId),
    );

    assignment?.roleIds.forEach((roleId) => roleIds.add(roleId));

    return roleIds;
  }

  public static assignedRolesFor(
    community: Community,
    identityId: string,
  ): CommunityRoleResource[] {
    const roleIds = CommunityAccessPolicy.assignedRoleIdsFor(
      community,
      identityId,
    );

    return (community.roles ?? []).filter((role) => roleIds.has(role.id));
  }

  public static canSeeChannel(
    community: Community,
    channel: CommunityChannel,
    identityId: string,
  ): boolean {
    if (CommunityAccessPolicy.isOwner(community, identityId)) return true;

    const visibleRoleIds = channel.permissions?.visibleRoleIds;

    if (!visibleRoleIds || visibleRoleIds.includes('everyone')) return true;

    const roleIds = CommunityAccessPolicy.assignedRoleIdsFor(
      community,
      identityId,
    );

    return visibleRoleIds.some((roleId) => roleIds.has(roleId));
  }

  public static hasPermission(
    community: Community,
    identityId: string,
    permission: CommunityPermission,
  ): boolean {
    return CommunityAccessPolicy.permissionsFor(community, identityId).has(
      permission,
    );
  }

  /** The owner id is stored as the node reported it, in either id form. */
  public static isOwner(community: Community, identityId: string): boolean {
    return IdentityMatch.isSame(community.ownerIdentityId, identityId);
  }

  public static membersWithChannelAccess(
    community: Community,
    channel: CommunityChannel,
  ): string[] {
    const bannedMemberIds = new Set(community.bannedMemberIds ?? []);

    return community.memberIds.filter(
      (identityId) =>
        !bannedMemberIds.has(identityId) &&
        CommunityAccessPolicy.canSeeChannel(community, channel, identityId),
    );
  }

  public static permissionsFor(
    community: Community,
    identityId: string,
  ): Set<CommunityPermission> {
    if (CommunityAccessPolicy.isOwner(community, identityId)) {
      return new Set(ALL_COMMUNITY_PERMISSIONS);
    }

    const permissions = new Set<CommunityPermission>();

    everyoneRole(community)?.permissions.forEach((permission) =>
      permissions.add(permission),
    );

    for (const role of CommunityAccessPolicy.assignedRolesFor(
      community,
      identityId,
    )) {
      role.permissions.forEach((permission) => permissions.add(permission));
    }

    return permissions;
  }
}

function everyoneRole(community: Community): CommunityRoleResource | undefined {
  return (community.roles ?? []).find((role) => role.id === 'everyone');
}
