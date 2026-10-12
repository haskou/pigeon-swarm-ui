import { StringValueObject } from '@haskou/value-objects';

export class RecoveryAuthority extends StringValueObject {
  public static fromString(value: string): RecoveryAuthority {
    return new RecoveryAuthority(value);
  }

  private constructor(value: string) {
    super(value);
  }
}
