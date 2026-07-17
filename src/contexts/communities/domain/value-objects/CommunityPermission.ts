import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

export class CommunityPermission extends Enum<
  | 'approve_members'
  | 'attach_files'
  | 'ban_members'
  | 'connect_voice'
  | 'create_invites'
  | 'create_polls'
  | 'embed_links'
  | 'manage_channels'
  | 'manage_members'
  | 'manage_messages'
  | 'manage_roles'
  | 'mention_everyone'
  | 'mention_here'
  | 'mention_roles'
  | 'reject_members'
  | 'send_messages'
  | 'send_stickers'
  | 'view_channels'
> {
  private static readonly values = [
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
  ] as const;

  private static isPermission(
    value: string,
  ): value is (typeof CommunityPermission.values)[number] {
    return CommunityPermission.values.some((candidate) => candidate === value);
  }

  public static all(): CommunityPermission[] {
    return CommunityPermission.values.map(
      (permission) => new CommunityPermission(permission),
    );
  }

  public static fromPrimitives(value: string): CommunityPermission {
    if (!CommunityPermission.isPermission(value)) {
      throw new ValueNotInEnumError(value, CommunityPermission.values);
    }

    return new CommunityPermission(value);
  }

  private constructor(value: (typeof CommunityPermission.values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof CommunityPermission.values)[number]> {
    return [...CommunityPermission.values];
  }
}
