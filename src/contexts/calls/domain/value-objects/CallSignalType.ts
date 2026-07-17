import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

export class CallSignalType extends Enum<'answer' | 'ice_candidate' | 'offer'> {
  private static readonly values: Array<'answer' | 'ice_candidate' | 'offer'> =
    ['answer', 'ice_candidate', 'offer'];

  private static isSignalType(
    value: string,
  ): value is 'answer' | 'ice_candidate' | 'offer' {
    return CallSignalType.values.some((type) => type === value);
  }

  public static fromPrimitives(value: string): CallSignalType {
    if (!CallSignalType.isSignalType(value)) {
      throw new ValueNotInEnumError(value, CallSignalType.values);
    }

    return new CallSignalType(value);
  }

  private constructor(value: 'answer' | 'ice_candidate' | 'offer') {
    super(value);
  }

  public getValues(): Array<'answer' | 'ice_candidate' | 'offer'> {
    return CallSignalType.values;
  }
}
