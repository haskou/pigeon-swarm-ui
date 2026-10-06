import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import { ConversationGroupNonce } from './value-objects/ConversationGroupNonce';
import { ConversationId } from './value-objects/ConversationId';
import { ConversationNetworkId } from './value-objects/ConversationNetworkId';
import { ConversationParticipantId } from './value-objects/ConversationParticipantId';

export class ConversationIdFactory {
  /**
   * `group:` + base64url(sha256(canonical {creatorIdentityId, networkId,
   * nonce})). The keys are already in canonical (sorted) order.
   */
  public createGroup(
    creatorIdentityId: ConversationParticipantId,
    networkId: ConversationNetworkId,
    nonce: ConversationGroupNonce,
  ): ConversationId {
    const digest = Buffer.from(
      SHA256Hash.from(
        JSON.stringify({
          creatorIdentityId: creatorIdentityId.toString(),
          networkId: networkId.toString(),
          nonce: nonce.toString(),
        }),
      ).toString(),
      'hex',
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return ConversationId.fromString(`group:${digest}`);
  }

  public create(
    leftIdentityId: ConversationParticipantId,
    rightIdentityId: ConversationParticipantId,
    networkId: ConversationNetworkId,
  ): ConversationId {
    const sorted = leftIdentityId
      .orderedWith(rightIdentityId)
      .map((identityId) => identityId.toString())
      .join(':');

    return ConversationId.fromString(
      `one-to-one:${SHA256Hash.from(
        `${sorted}:${networkId.toString()}`,
      ).toString()}`,
    );
  }
}
