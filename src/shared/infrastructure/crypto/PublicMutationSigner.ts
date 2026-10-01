import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import type { Session } from '../../domain/pigeonResources.types';
import type { PublicMutationIntent } from './PublicMutationIntent';
import type { PublicMutationPosition } from './PublicMutationPosition';
import type { SignedPublicMutation } from './SignedPublicMutation';

import { IdentityId } from '../../../contexts/identities/domain/value-objects/IdentityId';
import { canonicalJson } from './canonicalJson';

/**
 * Signs the intent of one public record mutation with the device credential.
 * The node holds no user private keys, so it only verifies and replicates it.
 */
export class PublicMutationSigner {
  private static readonly DOMAIN = 'pigeon:public-mutation:v1\n';

  public static readonly FIRST_POSITION: PublicMutationPosition = {
    predecessor: null,
    sequence: 0,
  };

  private base64Url(bytes: Uint8Array): string {
    return Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private digest(content: string): string {
    return this.base64Url(
      Buffer.from(SHA256Hash.from(content).toString(), 'hex'),
    );
  }

  private operationId(): string {
    const bytes = new Uint8Array(16);

    crypto.getRandomValues(bytes);

    return this.base64Url(bytes);
  }

  /** Identity that the node records as the author of the mutation. */
  public authorOf(session: Session): string {
    return IdentityId.normalize(session.identity.id);
  }

  public sign(
    session: Session,
    intent: PublicMutationIntent,
    position: PublicMutationPosition,
  ): SignedPublicMutation {
    const body = {
      author: {
        deviceCredential: IdentityId.normalize(
          session.deviceCredentialKeyPair.toPrimitives().publicKey,
        ),
        identityId: this.authorOf(session),
      },
      kind: intent.kind,
      operationId: this.operationId(),
      payloadDigest: this.digest(canonicalJson(intent.payload)),
      predecessor: position.predecessor,
      recordId: intent.recordId,
      sequence: position.sequence,
      store: intent.store,
      version: 1 as const,
    };
    const signature = session.deviceCredentialKeyPair
      .sign(`${PublicMutationSigner.DOMAIN}${canonicalJson(body)}`)
      .toString();

    return { ...body, signature };
  }
}
