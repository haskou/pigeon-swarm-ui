import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

export class CallConnectionState extends Enum<
  'closed' | 'connected' | 'connecting' | 'disconnected' | 'failed' | 'new'
> {
  private static readonly values: Array<
    'closed' | 'connected' | 'connecting' | 'disconnected' | 'failed' | 'new'
  > = ['closed', 'connected', 'connecting', 'disconnected', 'failed', 'new'];

  private static isConnectionState(
    value: string,
  ): value is
    | 'closed'
    | 'connected'
    | 'connecting'
    | 'disconnected'
    | 'failed'
    | 'new' {
    return CallConnectionState.values.some((state) => state === value);
  }

  public static fromPrimitives(value: string): CallConnectionState {
    if (!CallConnectionState.isConnectionState(value)) {
      throw new ValueNotInEnumError(value, CallConnectionState.values);
    }

    return new CallConnectionState(value);
  }

  private constructor(
    value:
      | 'closed'
      | 'connected'
      | 'connecting'
      | 'disconnected'
      | 'failed'
      | 'new',
  ) {
    super(value);
  }

  public getValues(): Array<
    'closed' | 'connected' | 'connecting' | 'disconnected' | 'failed' | 'new'
  > {
    return CallConnectionState.values;
  }
}
