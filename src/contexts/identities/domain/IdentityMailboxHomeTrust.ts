import {
  DeviceCredentialCommitment,
  PublicKey,
  Signature,
} from '@haskou/pigeon-swarm-crypto';

import { IdentityId } from './value-objects/IdentityId';

/**
 * Trust rule for the identity a node served for a requested id. The served
 * identity must be the requested one, its device credential must match the
 * published commitment, and the identity signature must verify over the signed
 * record content, which covers the mailbox home. Ids are compared as value
 * objects. Fails closed: a malformed id or credential, or any thrown error,
 * is not trusted.
 */
export class IdentityMailboxHomeTrust {
  public static isTrusted(claim: {
    deviceCredential: string;
    deviceCredentialCommitment: string;
    requestedId: string;
    servedId: string;
    signature: string;
    signedContent: string;
  }): boolean {
    try {
      const id = IdentityId.fromString(claim.requestedId);

      return (
        IdentityId.fromString(claim.servedId).isEqual(id) &&
        DeviceCredentialCommitment.of(new PublicKey(claim.deviceCredential)) ===
          claim.deviceCredentialCommitment &&
        id
          .getPublicKey()
          .isValidSignature(claim.signedContent, new Signature(claim.signature))
      );
    } catch {
      return false;
    }
  }
}
