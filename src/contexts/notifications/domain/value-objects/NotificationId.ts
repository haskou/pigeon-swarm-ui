import { StringValueObject, assert } from '@haskou/value-objects';

import { NotificationIdRequiredError } from '../errors/NotificationIdRequiredError';

export class NotificationId extends StringValueObject {
  public static fromString(value: string): NotificationId {
    return new NotificationId(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new NotificationIdRequiredError());
  }
}
