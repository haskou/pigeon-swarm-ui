import { Enum } from '@haskou/value-objects';

enum PollScopeTypePrimitive {
  COMMUNITY_CHANNEL = 'community_channel',
}

export class PollScopeType extends Enum<string> {
  public static readonly COMMUNITY_CHANNEL = new PollScopeType(
    PollScopeTypePrimitive.COMMUNITY_CHANNEL,
  );

  private constructor(value: string) {
    super(value);
  }

  public getValues(): string[] {
    return Object.values(PollScopeTypePrimitive);
  }
}
