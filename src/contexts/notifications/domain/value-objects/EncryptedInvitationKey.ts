import { ValueObject, assert } from '@haskou/value-objects';

import { EncryptedInvitationKeyRequiredError } from '../errors/EncryptedInvitationKeyRequiredError';

export class EncryptedInvitationKey extends ValueObject<string> {
  public static fromString(value: string): EncryptedInvitationKey {
    return new EncryptedInvitationKey(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.hasValue(''), new EncryptedInvitationKeyRequiredError());
  }
}
