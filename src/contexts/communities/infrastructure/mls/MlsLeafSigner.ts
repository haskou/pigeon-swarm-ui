import type { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { MlsLeafOwner } from './MlsGroup';

/**
 * The identity key of a device's owner, used to vouch for the signature key
 * of each MLS leaf the device creates. It never signs anything else here.
 */
export class MlsLeafSigner {
  public constructor(
    public readonly owner: MlsLeafOwner,
    private readonly keyPair: Pick<KeyPair, 'sign'>,
  ) {}

  /** A base64 signature of `message` by the owner's identity key. */
  public sign(message: string): string {
    return this.keyPair.sign(message).toString();
  }
}
