import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityChannelNameRequiredError } from '../errors/CommunityChannelNameRequiredError';

export class CommunityChannelName extends StringValueObject {
  public static readonly MAX_LENGTH = 80;

  public static fromString(value: string): CommunityChannelName {
    return new CommunityChannelName(value.trim());
  }

  private constructor(value: string) {
    super(value, CommunityChannelName.MAX_LENGTH);
    assert(!this.isEmpty(), new CommunityChannelNameRequiredError());
  }
}
