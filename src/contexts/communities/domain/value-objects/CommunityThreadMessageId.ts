import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityThreadMessageIdRequiredError } from '../errors/CommunityThreadMessageIdRequiredError';

export class CommunityThreadMessageId extends StringValueObject {
  public static fromString(value: string): CommunityThreadMessageId {
    return new CommunityThreadMessageId(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new CommunityThreadMessageIdRequiredError());
  }
}
