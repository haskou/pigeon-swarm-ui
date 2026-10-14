import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import { MlsLeafSigner } from '../../../../../contexts/communities/infrastructure/mls/MlsLeafSigner';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';

/**
 * A real identity key for MLS specs: leaf credentials must be signed by the
 * identity they name, so a spec's `alice` needs a key and an id derived from
 * it.
 */
export class MlsTestIdentity {
  private constructor(
    public readonly id: string,
    public readonly keyPair: KeyPair,
  ) {}

  /** One fresh identity per name. */
  public static async cast(
    names: readonly string[],
  ): Promise<Record<string, MlsTestIdentity>> {
    const identities = await Promise.all(
      names.map(async (name) => {
        const keyPair = await KeyPair.generate();
        const id = IdentityId.fromString(
          keyPair.toPrimitives().publicKey,
        ).valueOf();

        return [name, new MlsTestIdentity(id, keyPair)] as const;
      }),
    );

    return Object.fromEntries(identities);
  }

  /** This identity's signer for the leaves of one device. */
  public signer(deviceId = 'd1'): MlsLeafSigner {
    return new MlsLeafSigner({ deviceId, identityId: this.id }, this.keyPair);
  }
}
