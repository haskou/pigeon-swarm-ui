import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

export class CallStatus extends Enum<'active' | 'ended' | 'missed'> {
  private static readonly values: Array<'active' | 'ended' | 'missed'> = [
    'active',
    'ended',
    'missed',
  ];

  public static readonly ACTIVE = new CallStatus('active');
  public static readonly ENDED = new CallStatus('ended');
  public static readonly MISSED = new CallStatus('missed');

  private static isStatus(
    value: string,
  ): value is 'active' | 'ended' | 'missed' {
    return CallStatus.values.some((status) => status === value);
  }

  public static fromPrimitives(value: string): CallStatus {
    if (!CallStatus.isStatus(value)) {
      throw new ValueNotInEnumError(value, CallStatus.values);
    }

    return new CallStatus(value);
  }

  private constructor(value: 'active' | 'ended' | 'missed') {
    super(value);
  }

  public getValues(): Array<'active' | 'ended' | 'missed'> {
    return CallStatus.values;
  }

  public isActive(): boolean {
    return this.isEqual(CallStatus.ACTIVE);
  }

  public isEnded(): boolean {
    return this.isEqual(CallStatus.ENDED);
  }

  public isMissed(): boolean {
    return this.isEqual(CallStatus.MISSED);
  }
}
