import { StringValueObject, assert } from '@haskou/value-objects';

import { NotificationRoleIdRequiredError } from '../errors/NotificationRoleIdRequiredError';

export class NotificationRoleId extends StringValueObject {
  public static fromString(value: string): NotificationRoleId {
    return new NotificationRoleId(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new NotificationRoleIdRequiredError());
  }
}
