import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

export class CallScopeType extends Enum<'community_channel' | 'conversation'> {
  private static readonly values: Array<'community_channel' | 'conversation'> =
    ['community_channel', 'conversation'];

  public static readonly COMMUNITY_CHANNEL = new CallScopeType(
    'community_channel',
  );

  public static readonly CONVERSATION = new CallScopeType('conversation');

  private static isScopeType(
    value: string,
  ): value is 'community_channel' | 'conversation' {
    return CallScopeType.values.some((type) => type === value);
  }

  public static fromPrimitives(value: string): CallScopeType {
    if (!CallScopeType.isScopeType(value)) {
      throw new ValueNotInEnumError(value, CallScopeType.values);
    }

    return new CallScopeType(value);
  }

  private constructor(value: 'community_channel' | 'conversation') {
    super(value);
  }

  public getValues(): Array<'community_channel' | 'conversation'> {
    return CallScopeType.values;
  }

  public isCommunityChannel(): boolean {
    return this.isEqual(CallScopeType.COMMUNITY_CHANNEL);
  }
}
