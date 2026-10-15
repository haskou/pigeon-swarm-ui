import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

import type { CallScopeTypeValue } from './CallScopeTypeValue';

export class CallScopeType extends Enum<CallScopeTypeValue> {
  private static readonly values: CallScopeTypeValue[] = [
    'community_channel',
    'conversation',
    'group_capability',
  ];

  public static readonly COMMUNITY_CHANNEL = new CallScopeType(
    'community_channel',
  );

  public static readonly CONVERSATION = new CallScopeType('conversation');

  public static readonly GROUP_CAPABILITY = new CallScopeType(
    'group_capability',
  );

  private static isScopeType(value: string): value is CallScopeTypeValue {
    return CallScopeType.values.some((type) => type === value);
  }

  public static fromPrimitives(value: string): CallScopeType {
    if (!CallScopeType.isScopeType(value)) {
      throw new ValueNotInEnumError(value, CallScopeType.values);
    }

    return new CallScopeType(value);
  }

  private constructor(value: CallScopeTypeValue) {
    super(value);
  }

  public getValues(): CallScopeTypeValue[] {
    return CallScopeType.values;
  }

  public isCommunityChannel(): boolean {
    return this.isEqual(CallScopeType.COMMUNITY_CHANNEL);
  }

  public isGroupCapability(): boolean {
    return this.isEqual(CallScopeType.GROUP_CAPABILITY);
  }
}
