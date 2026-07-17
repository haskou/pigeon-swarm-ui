import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = [
  'CommunityChannelAdded',
  'CommunityChannelPermissionsUpdated',
  'CommunityChannelRemoved',
  'CommunityChannelRenamed',
  'CommunityMemberBanned',
  'CommunityMemberKicked',
  'CommunityMemberRolesAssigned',
  'CommunityMemberUnbanned',
  'CommunityProfileUpdated',
  'CommunityRoleAdded',
  'CommunityRoleRemoved',
  'CommunityRoleUpdated',
] as const;

export class CommunityEventType extends Enum<(typeof values)[number]> {
  public static readonly CHANNEL_ADDED = new CommunityEventType(
    'CommunityChannelAdded',
  );

  public static readonly CHANNEL_PERMISSIONS_UPDATED = new CommunityEventType(
    'CommunityChannelPermissionsUpdated',
  );

  public static readonly CHANNEL_REMOVED = new CommunityEventType(
    'CommunityChannelRemoved',
  );

  public static readonly CHANNEL_RENAMED = new CommunityEventType(
    'CommunityChannelRenamed',
  );

  public static readonly MEMBER_BANNED = new CommunityEventType(
    'CommunityMemberBanned',
  );

  public static readonly MEMBER_KICKED = new CommunityEventType(
    'CommunityMemberKicked',
  );

  public static readonly MEMBER_ROLES_ASSIGNED = new CommunityEventType(
    'CommunityMemberRolesAssigned',
  );

  public static readonly MEMBER_UNBANNED = new CommunityEventType(
    'CommunityMemberUnbanned',
  );

  public static readonly PROFILE_UPDATED = new CommunityEventType(
    'CommunityProfileUpdated',
  );

  public static readonly ROLE_ADDED = new CommunityEventType(
    'CommunityRoleAdded',
  );

  public static readonly ROLE_REMOVED = new CommunityEventType(
    'CommunityRoleRemoved',
  );

  public static readonly ROLE_UPDATED = new CommunityEventType(
    'CommunityRoleUpdated',
  );

  public static fromPrimitives(value: string): CommunityEventType {
    const type = values.find((candidate) => candidate === value);

    if (!type) throw new ValueNotInEnumError(value, values);

    return new CommunityEventType(type);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }
}
