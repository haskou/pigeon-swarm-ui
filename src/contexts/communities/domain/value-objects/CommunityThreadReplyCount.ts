import { Integer, assert } from '@haskou/value-objects';

import { CommunityThreadReplyCountNegativeError } from '../errors/CommunityThreadReplyCountNegativeError';

export class CommunityThreadReplyCount extends Integer {
  public static fromNumber(value: number): CommunityThreadReplyCount {
    return new CommunityThreadReplyCount(value);
  }

  private constructor(value: number) {
    super(value);
    assert(
      this.isGreaterOrEqualThan(0),
      new CommunityThreadReplyCountNegativeError(),
    );
  }
}
