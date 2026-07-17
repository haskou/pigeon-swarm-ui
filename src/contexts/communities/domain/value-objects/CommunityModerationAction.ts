import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = [
  'channel_created',
  'channel_deleted',
  'channel_permissions_updated',
  'channel_renamed',
  'community_updated',
  'invitation_created',
  'invite_link_created',
  'member_banned',
  'member_roles_updated',
  'member_unbanned',
  'membership_request_accepted',
  'membership_request_declined',
  'message_deleted',
  'role_created',
  'role_deleted',
  'role_updated',
] as const;

export class CommunityModerationAction extends Enum<(typeof values)[number]> {
  public static fromPrimitives(value: string): CommunityModerationAction {
    const action = values.find((candidate) => candidate === value);

    if (!action) throw new ValueNotInEnumError(value, values);

    return new CommunityModerationAction(action);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public toPrimitives() {
    return this.valueOf();
  }
}
