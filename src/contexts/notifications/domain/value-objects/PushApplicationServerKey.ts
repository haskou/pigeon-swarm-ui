import { StringValueObject } from '@haskou/value-objects';

export class PushApplicationServerKey extends StringValueObject {
  public static fromString(value?: string): PushApplicationServerKey {
    return new PushApplicationServerKey(value?.trim() ?? '');
  }

  private constructor(value: string) {
    super(value);
  }
}
