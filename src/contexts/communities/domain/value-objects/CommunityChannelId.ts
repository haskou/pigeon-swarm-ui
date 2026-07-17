import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityChannelNotFoundError } from '../errors/CommunityChannelNotFoundError';

export class CommunityChannelId extends StringValueObject {
  public static fromString(value: string): CommunityChannelId {
    return new CommunityChannelId(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new CommunityChannelNotFoundError());
  }
}
