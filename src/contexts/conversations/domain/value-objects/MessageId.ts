import { StringValueObject, assert } from '@haskou/value-objects';

import { MessageIdRequiredError } from '../errors/MessageIdRequiredError';

export class MessageId extends StringValueObject {
  public static fromString(value: string): MessageId {
    return new MessageId(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new MessageIdRequiredError());
  }
}
