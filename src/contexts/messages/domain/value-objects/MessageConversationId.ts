import { assert, StringValueObject } from '@haskou/value-objects';

import { MessageConversationIdRequiredError } from '../errors/MessageConversationIdRequiredError';

export class MessageConversationId extends StringValueObject {
  public static fromString(value: string): MessageConversationId {
    const conversationId = value.trim();

    assert(conversationId.length > 0, new MessageConversationIdRequiredError());

    return new MessageConversationId(conversationId);
  }

  private constructor(value: string) {
    super(value);
  }
}
