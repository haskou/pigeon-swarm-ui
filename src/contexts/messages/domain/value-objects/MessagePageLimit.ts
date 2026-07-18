import { Integer, assert } from '@haskou/value-objects';

import { MessagePageLimitInvalidError } from '../errors/MessagePageLimitInvalidError';

export class MessagePageLimit extends Integer {
  public static fromNumber(value: number): MessagePageLimit {
    return new MessagePageLimit(value);
  }

  private constructor(value: number) {
    super(value);
    assert(this.isGreaterOrEqualThan(1), new MessagePageLimitInvalidError());
  }
}
