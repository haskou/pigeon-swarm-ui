import { StringValueObject } from '@haskou/value-objects';

export class NetworkPeerOwnerId extends StringValueObject {
  public static fromOptional(value?: string): NetworkPeerOwnerId | undefined {
    const normalized = value?.trim();

    return normalized ? new NetworkPeerOwnerId(normalized) : undefined;
  }

  private constructor(value: string) {
    super(value);
  }
}
