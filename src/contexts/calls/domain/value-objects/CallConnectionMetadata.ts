import { StringValueObject } from '@haskou/value-objects';

export class CallConnectionMetadata extends StringValueObject {
  public static fromString(value: string): CallConnectionMetadata {
    return new CallConnectionMetadata(value.trim());
  }

  private constructor(value: string) {
    super(value);
  }
}
