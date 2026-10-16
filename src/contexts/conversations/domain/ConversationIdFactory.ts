import { CommitmentId } from '@haskou/pigeon-swarm-crypto';

import { ConversationGroupNonce } from './value-objects/ConversationGroupNonce';
import { ConversationId } from './value-objects/ConversationId';
import { ConversationNetworkId } from './value-objects/ConversationNetworkId';
import { ConversationParticipantId } from './value-objects/ConversationParticipantId';

/** Conversation ids are library commitments (`CommitmentId`). */
export class ConversationIdFactory {
  public createGroup(
    creatorIdentityId: ConversationParticipantId,
    networkId: ConversationNetworkId,
    nonce: ConversationGroupNonce,
  ): ConversationId {
    return ConversationId.fromString(
      CommitmentId.groupConversation(
        creatorIdentityId.toString(),
        networkId.toString(),
        nonce.toString(),
      ),
    );
  }

  public create(
    leftIdentityId: ConversationParticipantId,
    rightIdentityId: ConversationParticipantId,
    networkId: ConversationNetworkId,
  ): ConversationId {
    return ConversationId.fromString(
      CommitmentId.oneToOneConversation(
        leftIdentityId.toString(),
        rightIdentityId.toString(),
        networkId.toString(),
      ),
    );
  }
}
