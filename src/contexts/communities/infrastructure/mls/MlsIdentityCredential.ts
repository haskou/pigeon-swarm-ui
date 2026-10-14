import type { Credential } from 'ts-mls';

import { Signature } from '@haskou/pigeon-swarm-crypto';

import type { MlsLeafOwner } from './MlsGroup';
import type { MlsLeafSigner } from './MlsLeafSigner';

import { canonicalJson } from '../../../../shared/infrastructure/crypto/canonicalJson';
import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { MlsRejectedError } from './MlsRejectedError';

/**
 * The basic credential of an MLS leaf, bound to its identity: it names the
 * identity and device and carries the identity key's signature over the
 * leaf's signature public key. Nobody can present a leaf as another
 * identity's without that identity's key.
 */
export class MlsIdentityCredential {
  private static readonly DOMAIN = 'pigeon:mls-leaf-credential:v1\n';
  private static readonly SEPARATOR = '\u0000';
  private static readonly encoder = new TextEncoder();
  private static readonly decoder = new TextDecoder();

  private static message(
    { deviceId, identityId }: MlsLeafOwner,
    signaturePublicKey: Uint8Array,
  ): string {
    return `${MlsIdentityCredential.DOMAIN}${canonicalJson({
      deviceId,
      identityId,
      signaturePublicKey: encodeBase64Url(signaturePublicKey),
    })}`;
  }

  private static parts(credential: Credential): {
    owner: MlsLeafOwner;
    signature: string;
  } {
    if (credential.credentialType !== 'basic') {
      throw new MlsRejectedError('Unsupported credential type');
    }
    const [identityId, deviceId, signature, ...rest] =
      MlsIdentityCredential.decoder
        .decode(credential.identity)
        .split(MlsIdentityCredential.SEPARATOR);

    if (!identityId || !deviceId || !signature || rest.length > 0) {
      throw new MlsRejectedError('Malformed MLS credential');
    }

    return { owner: { deviceId, identityId }, signature };
  }

  /** The credential for a new leaf with this signature public key. */
  public static issue(
    signer: MlsLeafSigner,
    signaturePublicKey: Uint8Array,
  ): Credential {
    const { deviceId, identityId } = signer.owner;

    return {
      credentialType: 'basic',
      identity: MlsIdentityCredential.encoder.encode(
        [
          identityId,
          deviceId,
          signer.sign(
            MlsIdentityCredential.message(signer.owner, signaturePublicKey),
          ),
        ].join(MlsIdentityCredential.SEPARATOR),
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
   * The owner, when the identity it names signed this leaf key; otherwise
   * undefined. Never throws.
   */
  public static verify(
    credential: Credential,
    signaturePublicKey: Uint8Array,
  ): MlsLeafOwner | undefined {
    try {
      const { owner, signature } = MlsIdentityCredential.parts(credential);
      const valid = IdentityId.fromString(owner.identityId)
        .getPublicKey()
        .isValidSignature(
          MlsIdentityCredential.message(owner, signaturePublicKey),
          new Signature(signature),
        );

      return valid ? owner : undefined;
    } catch {
      return undefined;
    }
  }
}
