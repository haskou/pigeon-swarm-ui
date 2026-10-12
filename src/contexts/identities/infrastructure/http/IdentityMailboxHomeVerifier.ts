import { SHA256Hash, Signature } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';

import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

import { MailboxHomeBase } from '../../../../shared/infrastructure/client/MailboxHomeBase';
import { IdentityId } from '../../domain/value-objects/IdentityId';

export class IdentityMailboxHomeVerifier {
  /** Same alphabetical key order the identity signature was computed over. */
  private static signedContent(identity: IdentityResource): string {
    return JSON.stringify({
      admissionNonce: identity.admissionNonce,
      authorizationRevision: identity.authorizationRevision,
      deviceCredential: identity.deviceCredential,
      deviceCredentialCommitment: identity.deviceCredentialCommitment,
      id: identity.id,
      mailboxHome: identity.mailboxHome,
      networks: identity.networks,
      previousIdentityExternalIdentifier:
        identity.previousIdentityExternalIdentifier,
      profile: identity.profile,
      recoveryAuthority: identity.recoveryAuthority,
      timestamp: identity.timestamp,
      version: identity.version,
    });
  }

  /**
   * Fails closed: any mismatch, malformed input, or thrown error is not
   * authentic.
   */
  private static isAuthentic(
    requestedId: string,
    identity: IdentityResource,
  ): boolean {
    try {
      const id = IdentityId.fromString(requestedId);
      const commitment = SHA256Hash.from(
        new StringValueObject(identity.deviceCredential),
      ).valueOf();

      return (
        IdentityId.normalize(identity.id) === id.valueOf() &&
        commitment === identity.deviceCredentialCommitment &&
        id
          .getPublicKey()
          .isValidSignature(
            IdentityMailboxHomeVerifier.signedContent(identity),
            new Signature(identity.signature),
          )
      );
    } catch {
      return false;
    }
  }

  /**
   * Returns the node-served mailbox home base only when the identity signature
   * covers it.
   */
  public static verifiedBase(
    requestedId: string,
    identity: IdentityResource,
  ): string | undefined {
    const base = MailboxHomeBase.parse(identity.mailboxHome);

    return base !== undefined &&
      IdentityMailboxHomeVerifier.isAuthentic(requestedId, identity)
      ? base
      : undefined;
  }
}
