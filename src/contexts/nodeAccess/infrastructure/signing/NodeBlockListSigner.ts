import { CanonicalJson } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { NodeBlockListPrimitives } from '../../domain/NodeBlockList';
import type { SignedNodeBlockListResource } from '../http/resources/NodeAccessResources';

import { NodeBlockListNotIssuedError } from './errors/NodeBlockListNotIssuedError';

const documentType = 'pigeon-node-block-list';
const signingDomain = 'pigeon:node-block-list:v1\n';

/**
 * Signs a block list version the way nodes verify it: the owner identity key
 * signs `"pigeon:node-block-list:v1\n"` followed by the RFC 8785 canonical
 * JSON of the document without `identitySignature`.
 */
export class NodeBlockListSigner {
  public static signedContent(
    document: Omit<SignedNodeBlockListResource, 'identitySignature'>,
  ): string {
    return `${signingDomain}${CanonicalJson.serialize(document)}`;
  }

  public sign(
    list: NodeBlockListPrimitives,
    session: Session,
  ): Promise<SignedNodeBlockListResource> {
    if (list.version === null || list.issuedAt === null) {
      throw new NodeBlockListNotIssuedError();
    }

    const document = {
      blockedIdentityIds: list.blockedIdentityIds,
      blockedNodePeerIds: list.blockedNodePeerIds,
      issuedAt: list.issuedAt,
      ownerIdentityId: list.ownerIdentityId,
      type: documentType,
      version: list.version,
    } as const;
    const signature = session.keyPair.sign(
      NodeBlockListSigner.signedContent(document),
    );

    return Promise.resolve({
      ...document,
      identitySignature: signature.valueOf(),
    });
  }
}
