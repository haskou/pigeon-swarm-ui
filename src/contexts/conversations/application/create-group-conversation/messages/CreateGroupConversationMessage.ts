import { Timestamp } from '@haskou/value-objects';

import { ConversationGroupNonce } from '../../../domain/value-objects/ConversationGroupNonce';
import { ConversationName } from '../../../domain/value-objects/ConversationName';
import { ConversationNetworkId } from '../../../domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../../domain/value-objects/ConversationParticipantId';

export class CreateGroupConversationMessage {
  public constructor(
    private readonly name: string,
    private readonly networkId: string,
    private readonly participantIds: string[],
    private readonly actorIdentityId: string,
    private readonly nonce: string,
    private readonly occurredAt: number,
  ) {}

  public getActorIdentityId(): ConversationParticipantId {
    return ConversationParticipantId.fromString(this.actorIdentityId);
  }

  public getName(): ConversationName {
    return ConversationName.fromOptional(this.name);
  }

  public getNetworkId(): ConversationNetworkId {
    return ConversationNetworkId.fromString(this.networkId);
  }

  /** The nonce the group id derives from with its creator and network. */
  public getNonce(): ConversationGroupNonce {
    return ConversationGroupNonce.fromString(this.nonce);
  }

  public getParticipantIds(): ConversationParticipantId[] {
    return this.participantIds.map(ConversationParticipantId.fromString);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }
}
