import { DomainError, StringValueObject } from '@haskou/value-objects';

export class IdentityNetworkId extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }

  public static fromString(value: string): IdentityNetworkId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Identity network id is required.');
    }

    return new IdentityNetworkId(trimmedValue);
  }
}
