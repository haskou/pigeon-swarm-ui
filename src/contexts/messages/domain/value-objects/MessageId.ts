import { assert, StringValueObject } from '@haskou/value-objects';

import { MessageIdRequiredError } from '../errors/MessageIdRequiredError';

export class MessageId extends StringValueObject {
  public static fromString(value: string): MessageId {
    const trimmedValue = value.trim();

    assert(trimmedValue.length > 0, new MessageIdRequiredError());

    return new MessageId(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
