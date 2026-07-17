import { Timestamp } from '@haskou/value-objects';

import { ConversationId } from '../../../domain/value-objects/ConversationId';
import { ConversationParticipantId } from '../../../domain/value-objects/ConversationParticipantId';

export class InviteConversationParticipantMessage {
  public constructor(
    private readonly conversationId: string,
    private readonly recipientIdentityId: string,
    private readonly actorIdentityId: string,
    private readonly occurredAt: number,
  ) {}

  public getActorIdentityId(): ConversationParticipantId {
    return ConversationParticipantId.fromString(this.actorIdentityId);
  }

  public getConversationId(): ConversationId {
    return ConversationId.fromString(this.conversationId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getRecipientIdentityId(): ConversationParticipantId {
    return ConversationParticipantId.fromString(this.recipientIdentityId);
  }
}
