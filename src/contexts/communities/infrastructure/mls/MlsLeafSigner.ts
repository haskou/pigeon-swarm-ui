import type { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { MlsLeafOwner } from './MlsGroup';

/**
 * The identity key and the device credential key of a device, used to vouch
 * for the signature key of each MLS leaf the device creates. They never sign
 * anything else here.
 */
export class MlsLeafSigner {
  public constructor(
    public readonly owner: MlsLeafOwner,
    private readonly identityKey: Pick<KeyPair, 'sign'>,
    private readonly deviceKey: Pick<KeyPair, 'sign'>,
  ) {}

  /** Base64 signatures of `message` by the identity and the device key. */
  public sign(message: string): { device: string; identity: string } {
    return {
      device: this.deviceKey.sign(message).toString(),
      identity: this.identityKey.sign(message).toString(),
    };
  }
}
