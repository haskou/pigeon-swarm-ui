import { assert, StringValueObject } from '@haskou/value-objects';

import { MessageReactionEmojiRequiredError } from '../errors/MessageReactionEmojiRequiredError';

export class MessageReactionEmoji extends StringValueObject {
  public static fromString(value: string): MessageReactionEmoji {
    const trimmedValue = value.trim();

    assert(trimmedValue.length > 0, new MessageReactionEmojiRequiredError());

    return new MessageReactionEmoji(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
