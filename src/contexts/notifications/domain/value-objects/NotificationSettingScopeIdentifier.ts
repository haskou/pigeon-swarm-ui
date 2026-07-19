import { StringValueObject, assert } from '@haskou/value-objects';

import { NotificationScopeIdentifierRequiredError } from '../errors/NotificationScopeIdentifierRequiredError';

export class NotificationSettingScopeIdentifier extends StringValueObject {
  public static fromString(value: string): NotificationSettingScopeIdentifier {
    return new NotificationSettingScopeIdentifier(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new NotificationScopeIdentifierRequiredError());
  }
}
