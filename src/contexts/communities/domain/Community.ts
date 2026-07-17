import { Timestamp, assert, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { CommunityChannel } from './entities/CommunityChannel';
import { CommunityMember } from './entities/CommunityMember';
import { CommunityRole } from './entities/CommunityRole';
import { CommunityChannelNotFoundError } from './errors/CommunityChannelNotFoundError';
import { CommunityMemberNotFoundError } from './errors/CommunityMemberNotFoundError';
import { CommunityRoleNotFoundError } from './errors/CommunityRoleNotFoundError';
import { CommunityChannelId } from './value-objects/CommunityChannelId';
import { CommunityChannelName } from './value-objects/CommunityChannelName';
import { CommunityDescription } from './value-objects/CommunityDescription';
import { CommunityId } from './value-objects/CommunityId';
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
      primitives.members.map(CommunityMember.fromPrimitives),
      primitives.roles.map(CommunityRole.fromPrimitives),
      primitives.channels.map(CommunityChannel.fromPrimitives),
    );
  }

  private constructor(
    private readonly metadata: CommunityMetadata,
    private readonly profile: CommunityProfile,
    private readonly publication: CommunityPublicationSettings,
    private readonly members: CommunityMember[],
    private readonly roles: CommunityRole[],
    private readonly channels: CommunityChannel[],
  ) {
    super();
  }

  private channel(channelId: CommunityChannelId): CommunityChannel {
    const channel = this.channels.find((candidate) =>
      candidate.belongsTo(channelId),
    );

    assert(channel, new CommunityChannelNotFoundError());

    return channel;
  }

  private member(identityId: CommunityIdentityId): CommunityMember {
    const member = this.members.find((candidate) =>
      candidate.belongsTo(identityId),
    );

    assert(member, new CommunityMemberNotFoundError());

    return member;
  }

  private role(roleId: CommunityRoleId): CommunityRole {
    const role = this.roles.find((candidate) => candidate.belongsTo(roleId));

    assert(role, new CommunityRoleNotFoundError());

    return role;
  }

  public addChannel(channel: CommunityChannel, occurredAt: Timestamp): void {
    this.channels.push(channel);
    this.record({
      aggregateId: this.getId().toString(),
      occurredAt: occurredAt.valueOf(),
      type: 'CommunityChannelAdded',
    });
  }

  public addRole(role: CommunityRole, occurredAt: Timestamp): void {
    this.roles.push(role);
    this.record({
      aggregateId: this.getId().toString(),
      occurredAt: occurredAt.valueOf(),
      type: 'CommunityRoleAdded',
    });
  }

  public assignMemberRoles(
    identityId: CommunityIdentityId,
    roleIds: CommunityRoleId[],
    occurredAt: Timestamp,
  ): void {
    roleIds.forEach((roleId) => this.role(roleId));
    this.member(identityId).assignRoles(roleIds);
    this.record({
      aggregateId: this.getId().toString(),
      occurredAt: occurredAt.valueOf(),
      type: 'CommunityMemberRolesAssigned',
    });
  }

  public banMember(
    identityId: CommunityIdentityId,
    occurredAt: Timestamp,
  ): void {
    this.member(identityId).ban();
    this.record({
      aggregateId: this.getId().toString(),
      occurredAt: occurredAt.valueOf(),
      type: 'CommunityMemberBanned',
    });
  }

  public canSeeChannel(
    channelId: CommunityChannelId,
    identityId: CommunityIdentityId,
  ): boolean {
    if (this.isOwnedBy(identityId)) return true;

    return this.member(identityId).canAccess(this.channel(channelId));
  }

  public deleteChannel(
    channelId: CommunityChannelId,
    occurredAt: Timestamp,
  ): void {
    const channel = this.channel(channelId);
    const index = this.channels.indexOf(channel);

    this.channels.splice(index, 1);
    this.record({
      aggregateId: this.getId().toString(),
      occurredAt: occurredAt.valueOf(),
      type: 'CommunityChannelRemoved',
    });
  }

  public deleteRole(roleId: CommunityRoleId, occurredAt: Timestamp): void {
    const role = this.role(roleId);
    const index = this.roles.indexOf(role);

    this.roles.splice(index, 1);
    this.members.forEach((member) => member.removeRole(roleId));
    this.record({
      aggregateId: this.getId().toString(),
      occurredAt: occurredAt.valueOf(),
      type: 'CommunityRoleRemoved',
    });
  }

  public getId(): CommunityId {
    return this.metadata.getId();
  }

  public getChannelName(channelId: CommunityChannelId): CommunityChannelName {
    return this.channel(channelId).getName();
  }

  public getChannelVisibleRoleIds(
    channelId: CommunityChannelId,
  ): CommunityRoleId[] {
    return this.channel(channelId).getVisibleRoleIds();
  }

  public getMemberRoleIds(identityId: CommunityIdentityId): CommunityRoleId[] {
    return this.member(identityId).getRoleIds();
  }

  public getRoleName(roleId: CommunityRoleId): CommunityRoleName {
    return this.role(roleId).getName();
  }

  public getRolePermissions(roleId: CommunityRoleId): CommunityPermission[] {
    return this.role(roleId).getPermissions();
  }

  public isOwnedBy(identityId: CommunityIdentityId): boolean {
    return this.metadata.isOwnedBy(identityId);
  }

  public isPrivate(): boolean {
    return this.publication.isPrivate();
  }

  public isPublic(): boolean {
    return this.publication.isPublic();
  }

  public kickMember(
    identityId: CommunityIdentityId,
    occurredAt: Timestamp,
  ): void {
    const member = this.member(identityId);
    const index = this.members.indexOf(member);

    this.members.splice(index, 1);
    this.record({
      aggregateId: this.getId().toString(),
      occurredAt: occurredAt.valueOf(),
      type: 'CommunityMemberKicked',
    });
  }

  public membersWithChannelAccess(
    channelId: CommunityChannelId,
  ): CommunityIdentityId[] {
    const channel = this.channel(channelId);

    return this.members
      .filter((member) => member.canAccess(channel))
      .map((member) => member.getIdentityId());
  }

  public permissionsFor(
    identityId: CommunityIdentityId,
  ): CommunityPermission[] {
    if (this.isOwnedBy(identityId)) return CommunityPermission.all();

    const member = this.member(identityId);

    return CommunityPermission.all().filter((permission) =>
      this.roles.some(
        (role) =>
          (role.isEveryone() || member.hasRole(role.getId())) &&
          role.grants(permission),
      ),
    );
  }

  public renameChannel(
    channelId: CommunityChannelId,
    name: CommunityChannelName,
    occurredAt: Timestamp,
  ): void {
    this.channel(channelId).rename(name);
    this.record({
      aggregateId: this.getId().toString(),
      occurredAt: occurredAt.valueOf(),
      type: 'CommunityChannelRenamed',
    });
  }

  public restrictChannelTo(
    channelId: CommunityChannelId,
    roleIds: CommunityRoleId[],
    occurredAt: Timestamp,
  ): void {
    roleIds.forEach((roleId) => this.role(roleId));
    this.channel(channelId).restrictTo(roleIds);
    this.record({
      aggregateId: this.getId().toString(),
      occurredAt: occurredAt.valueOf(),
      type: 'CommunityChannelPermissionsUpdated',
    });
  }

  public unbanMember(
    identityId: CommunityIdentityId,
    occurredAt: Timestamp,
  ): void {
    this.member(identityId).unban();
    this.record({
      aggregateId: this.getId().toString(),
      occurredAt: occurredAt.valueOf(),
      type: 'CommunityMemberUnbanned',
    });
  }

  public updateProfile(
    name: CommunityName,
    description: CommunityDescription,
    avatar: CommunityMediaIdentifier,
    banner: CommunityMediaIdentifier,
    occurredAt: Timestamp,
  ): void {
    this.profile.update(name, description, avatar, banner);
    this.record({
      aggregateId: this.getId().toString(),
      occurredAt: occurredAt.valueOf(),
      type: 'CommunityProfileUpdated',
    });
  }

  public updateRole(
    roleId: CommunityRoleId,
    name: CommunityRoleName,
    permissions: CommunityPermission[],
    occurredAt: Timestamp,
  ): void {
    this.role(roleId).update(name, permissions);
    this.record({
      aggregateId: this.getId().toString(),
      occurredAt: occurredAt.valueOf(),
      type: 'CommunityRoleUpdated',
    });
  }

  public toPrimitives() {
    return {
      channels: this.channels.map((channel) => channel.toPrimitives()),
      members: this.members.map((member) => member.toPrimitives()),
      metadata: this.metadata.toPrimitives(),
      profile: this.profile.toPrimitives(),
      publication: this.publication.toPrimitives(),
      roles: this.roles.map((role) => role.toPrimitives()),
    };
  }
}
