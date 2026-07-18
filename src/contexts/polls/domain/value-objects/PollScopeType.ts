import { Enum } from '@haskou/value-objects';

enum PollScopeTypePrimitive {
  COMMUNITY_CHANNEL = 'community_channel',
  GROUP_CONVERSATION = 'group_conversation',
}

export class PollScopeType extends Enum<string> {
  public static readonly COMMUNITY_CHANNEL = new PollScopeType(
    PollScopeTypePrimitive.COMMUNITY_CHANNEL,
  );

  public static readonly GROUP_CONVERSATION = new PollScopeType(
    PollScopeTypePrimitive.GROUP_CONVERSATION,
  );

  public static fromPrimitives(value: string): PollScopeType {
    return new PollScopeType(value);
  }

  private constructor(value: string) {
    super(value);
  }

  public getValues(): string[] {
    return Object.values(PollScopeTypePrimitive);
  }

  public isCommunityChannel(): boolean {
    return this.isEqual(PollScopeType.COMMUNITY_CHANNEL);
  }
}
