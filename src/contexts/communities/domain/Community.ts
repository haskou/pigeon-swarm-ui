import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { CommunityChannel } from './entities/CommunityChannel';
import { CommunityChannels } from './entities/CommunityChannels';
import { CommunityMember } from './entities/CommunityMember';
import { CommunityMembers } from './entities/CommunityMembers';
import { CommunityRole } from './entities/CommunityRole';
import { CommunityRoles } from './entities/CommunityRoles';
import { CommunityChannelId } from './value-objects/CommunityChannelId';
import { CommunityChannelName } from './value-objects/CommunityChannelName';
import { CommunityDescription } from './value-objects/CommunityDescription';
import { CommunityEventType } from './value-objects/CommunityEventType';
import { CommunityIdentityId } from './value-objects/CommunityIdentityId';
import { CommunityMediaIdentifier } from './value-objects/CommunityMediaIdentifier';
import { CommunityMetadata } from './value-objects/CommunityMetadata';
import { CommunityName } from './value-objects/CommunityName';
import { CommunityPermission } from './value-objects/CommunityPermission';
import { CommunityProfile } from './value-objects/CommunityProfile';
import { CommunityPublicationSettings } from './value-objects/CommunityPublicationSettings';
import { CommunityRoleId } from './value-objects/CommunityRoleId';
import { CommunityRoleName } from './value-objects/CommunityRoleName';

export class Community extends AggregateRoot {
  public static fromPrimitives(primitives: PrimitiveOf<Community>): Community {
    return new Community(
      CommunityMetadata.fromPrimitives(primitives.metadata),
      CommunityProfile.fromPrimitives(primitives.profile),
      CommunityPublicationSettings.fromPrimitives(primitives.publication),
      CommunityMembers.fromPrimitives(primitives.members),
      CommunityRoles.fromPrimitives(primitives.roles),
      CommunityChannels.fromPrimitives(primitives.channels),
    );
  }

  private constructor(
    private readonly metadata: CommunityMetadata,
    private readonly profile: CommunityProfile,
    private readonly publication: CommunityPublicationSettings,
    private readonly members: CommunityMembers,
    private readonly roles: CommunityRoles,
    private readonly channels: CommunityChannels,
  ) {
    super();
  }

  private recordChange(type: CommunityEventType, occurredAt: Timestamp): void {
    this.record(this.metadata.identifyEvent(type, occurredAt));
  }

  public addChannel(channel: CommunityChannel, occurredAt: Timestamp): void {
    this.channels.add(channel);
    this.recordChange(CommunityEventType.CHANNEL_ADDED, occurredAt);
  }

  public addRole(role: CommunityRole, occurredAt: Timestamp): void {
    this.roles.add(role);
    this.recordChange(CommunityEventType.ROLE_ADDED, occurredAt);
  }

  public assignMemberRoles(
    identityId: CommunityIdentityId,
    roleIds: CommunityRoleId[],
    occurredAt: Timestamp,
  ): CommunityMember {
    this.roles.assertExist(roleIds);
    const member = this.members.assignRoles(identityId, roleIds);
    this.recordChange(CommunityEventType.MEMBER_ROLES_ASSIGNED, occurredAt);

    return member;
  }

  public banMember(
    identityId: CommunityIdentityId,
    occurredAt: Timestamp,
  ): void {
    this.members.ban(identityId);
    this.recordChange(CommunityEventType.MEMBER_BANNED, occurredAt);
  }

  public deleteChannel(
    channelId: CommunityChannelId,
    occurredAt: Timestamp,
  ): void {
    this.channels.remove(channelId);
    this.recordChange(CommunityEventType.CHANNEL_REMOVED, occurredAt);
  }

  public deleteRole(roleId: CommunityRoleId, occurredAt: Timestamp): void {
    this.roles.remove(roleId);
    this.members.removeRole(roleId);
    this.recordChange(CommunityEventType.ROLE_REMOVED, occurredAt);
  }

  public kickMember(
    identityId: CommunityIdentityId,
    occurredAt: Timestamp,
  ): void {
    this.members.remove(identityId);
    this.recordChange(CommunityEventType.MEMBER_KICKED, occurredAt);
  }

  public renameChannel(
    channelId: CommunityChannelId,
    name: CommunityChannelName,
    occurredAt: Timestamp,
  ): CommunityChannel {
    const channel = this.channels.rename(channelId, name);
    this.recordChange(CommunityEventType.CHANNEL_RENAMED, occurredAt);

    return channel;
  }

  public restrictChannelTo(
    channelId: CommunityChannelId,
    roleIds: CommunityRoleId[],
    occurredAt: Timestamp,
  ): CommunityChannel {
    this.roles.assertExist(roleIds);
    const channel = this.channels.restrict(channelId, roleIds);
    this.recordChange(
      CommunityEventType.CHANNEL_PERMISSIONS_UPDATED,
      occurredAt,
    );

    return channel;
  }

  public unbanMember(
    identityId: CommunityIdentityId,
    occurredAt: Timestamp,
  ): void {
    this.members.unban(identityId);
    this.recordChange(CommunityEventType.MEMBER_UNBANNED, occurredAt);
  }

  public updateProfile(
    name: CommunityName,
    description: CommunityDescription,
    avatar: CommunityMediaIdentifier,
    banner: CommunityMediaIdentifier,
    occurredAt: Timestamp,
  ): void {
    this.profile.update(name, description, avatar, banner);
    this.recordChange(CommunityEventType.PROFILE_UPDATED, occurredAt);
  }

  public updateRole(
    roleId: CommunityRoleId,
    name: CommunityRoleName,
    permissions: CommunityPermission[],
    occurredAt: Timestamp,
  ): CommunityRole {
    const role = this.roles.update(roleId, name, permissions);
    this.recordChange(CommunityEventType.ROLE_UPDATED, occurredAt);

    return role;
  }

  public toPrimitives() {
    return {
      channels: this.channels.toPrimitives(),
      members: this.members.toPrimitives(),
      metadata: this.metadata.toPrimitives(),
      profile: this.profile.toPrimitives(),
      publication: this.publication.toPrimitives(),
      roles: this.roles.toPrimitives(),
    };
  }
}
