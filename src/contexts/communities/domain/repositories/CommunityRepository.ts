import type { Community } from '../Community';
import type { CommunityChannel } from '../entities/CommunityChannel';
import type { CommunityRole } from '../entities/CommunityRole';
import type { CommunityChannelId } from '../value-objects/CommunityChannelId';
import type { CommunityChannelName } from '../value-objects/CommunityChannelName';
import type { CommunityId } from '../value-objects/CommunityId';
import type { CommunityIdentityId } from '../value-objects/CommunityIdentityId';
import type { CommunityPermission } from '../value-objects/CommunityPermission';
import type { CommunityRoleId } from '../value-objects/CommunityRoleId';
import type { CommunityRoleName } from '../value-objects/CommunityRoleName';

export interface CommunityRepository {
  assignMemberRoles(
    community: Community,
    memberIdentityId: CommunityIdentityId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community>;
  banMember(
    community: Community,
    memberIdentityId: CommunityIdentityId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community>;
  createRole(
    community: Community,
    name: CommunityRoleName,
    permissions: CommunityPermission[],
    actorIdentityId: CommunityIdentityId,
  ): Promise<CommunityRole>;
  createTextChannel(
    community: Community,
    name: CommunityChannelName,
    actorIdentityId: CommunityIdentityId,
  ): Promise<CommunityChannel>;
  createVoiceChannel(
    community: Community,
    name: CommunityChannelName,
    actorIdentityId: CommunityIdentityId,
  ): Promise<CommunityChannel>;
  deleteChannel(
    community: Community,
    channelId: CommunityChannelId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community>;
  deleteRole(
    community: Community,
    roleId: CommunityRoleId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<void>;
  find(
    communityId: CommunityId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community>;
  kickMember(
    community: Community,
    memberIdentityId: CommunityIdentityId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community>;
  leave(
    community: Community,
    actorIdentityId: CommunityIdentityId,
  ): Promise<void>;
  renameChannel(
    community: Community,
    channelId: CommunityChannelId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<CommunityChannel>;
  restrictChannel(
    community: Community,
    channelId: CommunityChannelId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<CommunityChannel>;
  search(actorIdentityId: CommunityIdentityId): Promise<Community[]>;
  unbanMember(
    community: Community,
    memberIdentityId: CommunityIdentityId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community>;
  updateProfile(
    community: Community,
    actorIdentityId: CommunityIdentityId,
  ): Promise<Community>;
  updateRole(
    community: Community,
    roleId: CommunityRoleId,
    actorIdentityId: CommunityIdentityId,
  ): Promise<CommunityRole>;
}
