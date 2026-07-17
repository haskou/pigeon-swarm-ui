import { Timestamp } from '@haskou/value-objects';

import { ConversationNetworkId } from '../../../domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../../domain/value-objects/ConversationParticipantId';

export class CreateConversationMessage {
  public constructor(
    private readonly networkId: string,
    private readonly peerIdentityId: string,
    private readonly actorIdentityId: string,
    private readonly occurredAt: number,
  ) {}

  public getActorIdentityId(): ConversationParticipantId {
    return ConversationParticipantId.fromString(this.actorIdentityId);
  }

  public getNetworkId(): ConversationNetworkId {
    return ConversationNetworkId.fromString(this.networkId);
  }

  public getPeerIdentityId(): ConversationParticipantId {
    return ConversationParticipantId.fromString(this.peerIdentityId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }
}
