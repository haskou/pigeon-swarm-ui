import { StringValueObject } from '@haskou/value-objects';

import { CallScopeIdentifierRequiredError } from '../errors/CallScopeIdentifierRequiredError';

export class CallScopeIdentifier extends StringValueObject {
  public static fromString(value: string): CallScopeIdentifier {
    const normalized = value.trim();

    if (!normalized) throw new CallScopeIdentifierRequiredError();

    return new CallScopeIdentifier(normalized);
  }

  private constructor(value: string) {
    super(value);
  }
}
