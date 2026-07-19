import { StringValueObject } from '@haskou/value-objects';

import { NetworkPeerIdRequiredError } from '../errors/NetworkPeerIdRequiredError';

export class NetworkPeerId extends StringValueObject {
  public static fromString(value: string): NetworkPeerId {
    const normalized = value.trim();

    if (!normalized) throw new NetworkPeerIdRequiredError();

    return new NetworkPeerId(normalized);
  }

  private constructor(value: string) {
    super(value);
  }
}
