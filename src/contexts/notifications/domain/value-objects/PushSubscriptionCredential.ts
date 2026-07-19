import { StringValueObject, assert } from '@haskou/value-objects';

import { PushSubscriptionCredentialRequiredError } from '../errors/PushSubscriptionCredentialRequiredError';

export class PushSubscriptionCredential extends StringValueObject {
  public static fromString(value: string): PushSubscriptionCredential {
    return new PushSubscriptionCredential(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new PushSubscriptionCredentialRequiredError());
  }
}
