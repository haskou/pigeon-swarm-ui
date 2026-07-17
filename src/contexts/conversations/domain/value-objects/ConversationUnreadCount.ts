import { Integer, assert } from '@haskou/value-objects';

import { ConversationUnreadCountInvalidError } from '../errors/ConversationUnreadCountInvalidError';

export class ConversationUnreadCount extends Integer {
  public static fromNumber(value = 0): ConversationUnreadCount {
    return new ConversationUnreadCount(value);
  }

  private constructor(value: number) {
    super(value);
    assert(
      this.isGreaterOrEqualThan(0),
      new ConversationUnreadCountInvalidError(),
    );
  }

  public clear(): ConversationUnreadCount {
    return ConversationUnreadCount.fromNumber(0);
  }
}
