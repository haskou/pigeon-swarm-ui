import { StringValueObject, assert } from '@haskou/value-objects';

import { PushSubscriptionEndpointRequiredError } from '../errors/PushSubscriptionEndpointRequiredError';

export class PushSubscriptionEndpoint extends StringValueObject {
  public static fromString(value: string): PushSubscriptionEndpoint {
    return new PushSubscriptionEndpoint(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new PushSubscriptionEndpointRequiredError());
  }
}
