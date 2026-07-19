import { StringValueObject, assert } from '@haskou/value-objects';

import { NotificationRecipientIdRequiredError } from '../errors/NotificationRecipientIdRequiredError';

export class NotificationRecipientId extends StringValueObject {
  public static fromString(value: string): NotificationRecipientId {
    return new NotificationRecipientId(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new NotificationRecipientIdRequiredError());
  }
}
