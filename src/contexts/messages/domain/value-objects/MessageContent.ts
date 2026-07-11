import { StringValueObject } from '@haskou/value-objects';

export class MessageContent extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }

  public static fromString(value: string): MessageContent {
    return new MessageContent(value);
  }

  public isBlank(): boolean {
    return this.toString().trim().length === 0;
  }
}
