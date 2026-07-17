import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

export class CallCandidateType extends Enum<
  'host' | 'prflx' | 'relay' | 'srflx'
> {
  private static readonly values: Array<'host' | 'prflx' | 'relay' | 'srflx'> =
    ['host', 'prflx', 'relay', 'srflx'];

  private static isCandidateType(
    value: string,
  ): value is 'host' | 'prflx' | 'relay' | 'srflx' {
    return CallCandidateType.values.some((candidate) => candidate === value);
  }

  public static fromPrimitives(value: string): CallCandidateType {
    if (!CallCandidateType.isCandidateType(value)) {
      throw new ValueNotInEnumError(value, CallCandidateType.values);
    }

    return new CallCandidateType(value);
  }

  private constructor(value: 'host' | 'prflx' | 'relay' | 'srflx') {
    super(value);
  }

  public getValues(): Array<'host' | 'prflx' | 'relay' | 'srflx'> {
    return CallCandidateType.values;
  }
}
