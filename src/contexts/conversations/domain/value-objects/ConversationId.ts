import { StringValueObject, assert } from '@haskou/value-objects';

import { ConversationIdRequiredError } from '../errors/ConversationIdRequiredError';

export class ConversationId extends StringValueObject {
  public static fromString(value: string): ConversationId {
    return new ConversationId(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new ConversationIdRequiredError());
  }

  public isGroup(): boolean {
    return this.toString().startsWith('group:');
  }
}
