import type { Credential } from 'ts-mls';

import { Signature } from '@haskou/pigeon-swarm-crypto';

import type { MlsLeafOwner } from './MlsGroup';
import type { MlsLeafSigner } from './MlsLeafSigner';

import { canonicalJson } from '../../../../shared/infrastructure/crypto/canonicalJson';
import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { DeviceCredential } from '../../../identities/domain/value-objects/DeviceCredential';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { MlsRejectedError } from './MlsRejectedError';

/**
 * The basic credential of an MLS leaf, bound to its identity and device: it
 * names the identity and the device credential, and carries the signatures
 * of both keys over the leaf's signature public key. Nobody can present a
 * leaf as another identity's without that identity's key, and a device that
 * holds the identity key but was revoked cannot present a leaf as a
 * current device's without that device's key.
 */
export class MlsIdentityCredential {
  private static readonly DOMAIN = 'pigeon:mls-leaf-credential:v2\n';
  private static readonly SEPARATOR = '\u0000';
  private static readonly encoder = new TextEncoder();
  private static readonly decoder = new TextDecoder();

  private static message(
    { deviceCredential, identityId }: MlsLeafOwner,
    signaturePublicKey: Uint8Array,
  ): string {
    return `${MlsIdentityCredential.DOMAIN}${canonicalJson({
      deviceCredential,
      identityId,
      signaturePublicKey: encodeBase64Url(signaturePublicKey),
    })}`;
  }

  private static parts(credential: Credential): {
    deviceSignature: string;
    identitySignature: string;
    owner: MlsLeafOwner;
  } {
    if (credential.credentialType !== 'basic') {
      throw new MlsRejectedError('Unsupported credential type');
    }
    const [
      identityId,
      deviceCredential,
      identitySignature,
      deviceSignature,
      ...rest
    ] = MlsIdentityCredential.decoder
      .decode(credential.identity)
      .split(MlsIdentityCredential.SEPARATOR);

    if (
      !identityId ||
      !deviceCredential ||
      !identitySignature ||
      !deviceSignature ||
      rest.length > 0
    ) {
      throw new MlsRejectedError('Malformed MLS credential');
    }

    return {
      deviceSignature,
      identitySignature,
      owner: { deviceCredential, identityId },
    };
  }

  /** The credential for a new leaf with this signature public key. */
  public static issue(
    signer: MlsLeafSigner,
    signaturePublicKey: Uint8Array,
  ): Credential {
    const { deviceCredential, identityId } = signer.owner;
    const { device, identity } = signer.sign(
      MlsIdentityCredential.message(signer.owner, signaturePublicKey),
    );

    return {
      credentialType: 'basic',
      identity: MlsIdentityCredential.encoder.encode(
        [identityId, deviceCredential, identity, device].join(
          MlsIdentityCredential.SEPARATOR,
        ),
      ),
    };
  }

  /**
   * The owner a credential names, without checking it. Only for leaves
   * already validated on their way into the tree.
   */
  public static ownerOf(credential: Credential): MlsLeafOwner {
    return MlsIdentityCredential.parts(credential).owner;
  }

  /**
   * The owner, when both the identity and the device it names signed this
   * leaf key; otherwise undefined. Never throws.
   */
  public static verify(
    credential: Credential,
    signaturePublicKey: Uint8Array,
  ): MlsLeafOwner | undefined {
    try {
      const { deviceSignature, identitySignature, owner } =
        MlsIdentityCredential.parts(credential);
      const message = MlsIdentityCredential.message(owner, signaturePublicKey);
      const valid =
        IdentityId.fromString(owner.identityId)
          .getPublicKey()
          .isValidSignature(message, new Signature(identitySignature)) &&
        DeviceCredential.fromString(owner.deviceCredential)
          .getPublicKey()
          .isValidSignature(message, new Signature(deviceSignature));

      return valid ? owner : undefined;
    } catch {
      return undefined;
    }
  }
}
