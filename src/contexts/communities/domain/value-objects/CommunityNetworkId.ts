import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityNetworkIdRequiredError } from '../errors/CommunityNetworkIdRequiredError';

export class CommunityNetworkId extends StringValueObject {
  public static fromString(value: string): CommunityNetworkId {
    return new CommunityNetworkId(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new CommunityNetworkIdRequiredError());
  }
}
