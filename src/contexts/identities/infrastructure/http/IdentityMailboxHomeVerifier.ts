import type { IdentityResource } from './resources/IdentityResource';

import { MailboxHomeBase } from '../../../../shared/infrastructure/client/MailboxHomeBase';
import { IdentityMailboxHomeTrust } from '../../domain/IdentityMailboxHomeTrust';

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
   * Whether the node-served identity record is the requested identity, signed
   * by its identity key, with the device credential its commitment binds.
   */
  public static isTrusted(
    requestedId: string,
    identity: IdentityResource,
  ): boolean {
    return IdentityMailboxHomeTrust.isTrusted({
      deviceCredential: identity.deviceCredential,
      deviceCredentialCommitment: identity.deviceCredentialCommitment,
      requestedId,
      servedId: identity.id,
      signature: identity.signature,
      signedContent: IdentityMailboxHomeVerifier.signedContent(identity),
    });
  }

  /**
   * Returns the node-served mailbox home base only when the identity is
   * trusted for the requested id. The trust decision lives in
   * IdentityMailboxHomeTrust; this adapter parses the base and serializes the
   * signed record.
   */
  public static verifiedBase(
    requestedId: string,
    identity: IdentityResource,
  ): string | undefined {
    const base = MailboxHomeBase.parse(identity.mailboxHome);

    if (base === undefined) return undefined;

    return IdentityMailboxHomeVerifier.isTrusted(requestedId, identity)
      ? base
      : undefined;
  }
}
