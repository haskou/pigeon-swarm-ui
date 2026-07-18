import { assert, StringValueObject } from '@haskou/value-objects';

import { NetworkNodeOwnerRequiredError } from '../errors/NetworkNodeOwnerRequiredError';

export class NetworkNodeOwnerId extends StringValueObject {
  public static fromOptional(value?: string | null): NetworkNodeOwnerId {
    return new NetworkNodeOwnerId(value?.trim() ?? '');
  }

  public static fromString(value: string): NetworkNodeOwnerId {
    const normalized = value.trim();

    assert(Boolean(normalized), new NetworkNodeOwnerRequiredError());

    return new NetworkNodeOwnerId(normalized);
  }

  private constructor(value: string) {
    super(value);
  }

  public isAssigned(): boolean {
    return !this.isEmpty();
  }
}
