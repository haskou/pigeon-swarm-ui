import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { MlsLeafOwner } from '../../../../../contexts/communities/infrastructure/mls/MlsGroup';

import { MlsLeafSigner } from '../../../../../contexts/communities/infrastructure/mls/MlsLeafSigner';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';

/**
 * A real identity key for MLS specs: leaf credentials must be signed by the
 * identity and the device they name, so a spec's `alice` needs an identity
 * key, an id derived from it, and a key per device (`d1` to `d4`, `d9`).
 */
export class MlsTestIdentity {
  private static readonly DEVICES = ['d1', 'd2', 'd3', 'd4', 'd9'] as const;

  private constructor(
    public readonly id: string,
    public readonly keyPair: KeyPair,
    private readonly devices: Record<string, KeyPair>,
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
        const devices = Object.fromEntries(
          await Promise.all(
            MlsTestIdentity.DEVICES.map(
              async (device) => [device, await KeyPair.generate()] as const,
            ),
          ),
        );

        return [name, new MlsTestIdentity(id, keyPair, devices)] as const;
      }),
    );

    return Object.fromEntries(identities);
  }

  /** One device's credential key, to forge leaves in specs. */
  public deviceKeyPair(device = 'd1'): KeyPair {
    return this.devices[device];
  }

  /** The device credential, a public key PEM, of one of these devices. */
  public deviceCredential(device = 'd1'): string {
    return this.devices[device].toPrimitives().publicKey;
  }

  /** The owner of one device's leaves. */
  public owner(device = 'd1'): MlsLeafOwner {
    return {
      deviceCredential: this.deviceCredential(device),
      identityId: this.id,
    };
  }

  /** This identity's signer for the leaves of one device. */
  public signer(device = 'd1'): MlsLeafSigner {
    return new MlsLeafSigner(
      this.owner(device),
      this.keyPair,
      this.devices[device],
    );
  }
}
