import { PublicKey } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';

export class PairingTransportPublicKey extends StringValueObject {
  public static fromPublicKey(publicKey: PublicKey): PairingTransportPublicKey {
    return new PairingTransportPublicKey(publicKey.valueOf());
  }

  public static fromString(value: string): PairingTransportPublicKey {
    return PairingTransportPublicKey.fromPublicKey(PublicKey.fromPEM(value));
  }

  private constructor(value: string) {
    super(value);
  }

  public getPublicKey(): PublicKey {
    return PublicKey.fromPEM(this);
  }
}
