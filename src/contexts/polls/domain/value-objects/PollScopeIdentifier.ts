import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidPollScopeIdentifierError } from '../errors/InvalidPollScopeIdentifierError';

export class PollScopeIdentifier extends StringValueObject {
  public static fromString(value: string): PollScopeIdentifier {
    const identifier = value.trim();

    assert(identifier.length > 0, new InvalidPollScopeIdentifierError());

    return new PollScopeIdentifier(identifier);
  }

  private constructor(value: string) {
    super(value);
  }
}
