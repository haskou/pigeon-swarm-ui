import { StringValueObject, assert } from '@haskou/value-objects';

import { ConversationNetworkIdRequiredError } from '../errors/ConversationNetworkIdRequiredError';

export class ConversationNetworkId extends StringValueObject {
  public static fromString(value: string): ConversationNetworkId {
    return new ConversationNetworkId(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new ConversationNetworkIdRequiredError());
  }
}
