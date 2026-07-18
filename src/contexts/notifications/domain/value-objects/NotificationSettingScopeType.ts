import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = ['conversation', 'community', 'community_channel'] as const;

export class NotificationSettingScopeType extends Enum<
  (typeof values)[number]
> {
  public static readonly COMMUNITY = new NotificationSettingScopeType(
    'community',
  );

  public static readonly COMMUNITY_CHANNEL = new NotificationSettingScopeType(
    'community_channel',
  );

  public static readonly CONVERSATION = new NotificationSettingScopeType(
    'conversation',
  );

  public static fromPrimitives(value: string): NotificationSettingScopeType {
    const type = values.find((candidate) => candidate === value);

    if (!type) throw new ValueNotInEnumError(value, values);

    return new NotificationSettingScopeType(type);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isCommunity(): boolean {
    return this.isEqual(NotificationSettingScopeType.COMMUNITY);
  }

  public isCommunityChannel(): boolean {
    return this.isEqual(NotificationSettingScopeType.COMMUNITY_CHANNEL);
  }
}
