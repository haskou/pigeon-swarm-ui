import type { PublicMutation } from '@haskou/pigeon-swarm-crypto';

import {
  PrivateKey,
  PublicMutationSignature,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { AuthorizationRevisionSource } from './AuthorizationRevisionSource';
import type { PublicMutationIntent } from './PublicMutationIntent';
import type { PublicMutationPosition } from './PublicMutationPosition';

import { IdentityId } from '../../../contexts/identities/domain/value-objects/IdentityId';

/**
 * Signs the intent of one public record mutation with the device credential.
 * The node holds no user private keys, so it only verifies and replicates it.
 */
export class PublicMutationSigner {
  public static readonly FIRST_POSITION: PublicMutationPosition = {
    predecessor: null,
    sequence: 0,
  };

  public constructor(private readonly revisions: AuthorizationRevisionSource) {}

  private operationId(): string {
    return PublicMutationSignature.newOperationId();
  }

  /** base64url sha256 of the canonical JSON of a value. */
  public digestOfValue(value: unknown): string {
    return PublicMutationSignature.payloadDigest(value);
  }

  /** Digest a successor commits to as its predecessor. */
  public digestOf(mutation: PublicMutation): string {
    return PublicMutationSignature.digest(mutation);
  }

  /** Identity that the node records as the author of the mutation. */
  public authorOf(session: Session): string {
    return IdentityId.normalize(session.identity.id);
  }

  public async sign(
    session: Session,
    intent: PublicMutationIntent,
    position: PublicMutationPosition,
  ): Promise<PublicMutation> {
    const device = session.deviceCredentialKeyPair.toPrimitives();

    return PublicMutationSignature.sign(
      {
        author: {
          authorizationRevision: await this.revisions.current(session),
          deviceCredential: IdentityId.normalize(device.publicKey),
          identityId: this.authorOf(session),
        },
        ...(intent.frontier?.length ? { frontier: intent.frontier } : {}),
        kind: intent.kind,
        operationId: this.operationId(),
        payloadDigest: PublicMutationSignature.payloadDigest(intent.payload),
        predecessor: position.predecessor,
        recordId: intent.recordId,
        sequence: position.sequence,
        store: intent.store,
        version: 2,
      },
      new PrivateKey(device.privateKey),
    );
  }
}
