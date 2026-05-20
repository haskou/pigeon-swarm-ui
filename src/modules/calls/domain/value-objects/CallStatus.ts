import { StringValueObject, ValueNotInEnumError } from '@haskou/value-objects';

import type { CallResource } from '../callSession.types';

export class CallStatus extends StringValueObject {
  private constructor(value: CallResource['status']) {
    super(value);
  }

  public static active(): CallStatus {
    return new CallStatus('active');
  }

  public static ended(): CallStatus {
    return new CallStatus('ended');
  }

  public static fromPrimitive(value: string): CallStatus {
    if (!CallStatus.isValid(value)) {
      throw new ValueNotInEnumError(value, ['active', 'ended', 'missed']);
    }

    return new CallStatus(value);
  }

  public static missed(): CallStatus {
    return new CallStatus('missed');
  }

  public isActive(): boolean {
    return this.isEqual(CallStatus.active());
  }

  public isEnded(): boolean {
    return this.isEqual(CallStatus.ended());
  }

  public isMissed(): boolean {
    return this.isEqual(CallStatus.missed());
  }

  private static isValid(value: string): value is CallResource['status'] {
    return value === 'active' || value === 'ended' || value === 'missed';
  }
}
