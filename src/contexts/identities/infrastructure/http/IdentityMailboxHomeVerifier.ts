import { IdentitySignature } from '@haskou/pigeon-swarm-crypto';

import type { IdentityResource } from './resources/IdentityResource';

import { MailboxHomeBase } from '../../../../shared/infrastructure/client/MailboxHomeBase';
import { IdentityMailboxHomeTrust } from '../../domain/IdentityMailboxHomeTrust';
import { IdentitySignaturePayloadFactory } from './IdentitySignaturePayloadFactory';

export class IdentityMailboxHomeVerifier {
  /**
   * The content the identity key signed, or undefined when the record is not
   * a well-formed identity whose commitment binds its device credential.
   */
  private static signedContent(identity: IdentityResource): string | undefined {
    try {
      return IdentitySignature.signingContent(
        IdentitySignaturePayloadFactory.payloadOf(identity),
      );
    } catch {
      return undefined;
    }
  }

  /**
   * Whether the node-served identity record is the requested identity, signed
   * by its identity key, with the device credential its commitment binds.
   */
  public static isTrusted(
    requestedId: string,
    identity: IdentityResource,
  ): boolean {
    const signedContent = IdentityMailboxHomeVerifier.signedContent(identity);

    return (
      signedContent !== undefined &&
      IdentityMailboxHomeTrust.isTrusted({
        deviceCredential: identity.deviceCredential,
        deviceCredentialCommitment: identity.deviceCredentialCommitment,
        requestedId,
        servedId: identity.id,
        signature: identity.signature,
        signedContent,
      })
    );
  }

  /**
   * Returns the node-served mailbox home base only when the identity is
   * trusted for the requested id. The trust decision lives in
   * IdentityMailboxHomeTrust; this adapter parses the base and builds the
   * signed content.
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
