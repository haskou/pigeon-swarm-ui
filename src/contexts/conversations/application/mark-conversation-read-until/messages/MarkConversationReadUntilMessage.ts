import { Timestamp } from '@haskou/value-objects';

import { ConversationId } from '../../../domain/value-objects/ConversationId';
import { ConversationParticipantId } from '../../../domain/value-objects/ConversationParticipantId';
import { MessageId } from '../../../domain/value-objects/MessageId';

export class MarkConversationReadUntilMessage {
  public constructor(
    private readonly conversationId: string,
    private readonly messageId: string,
    private readonly actorIdentityId: string,
    private readonly occurredAt: number,
  ) {}

  public getActorIdentityId(): ConversationParticipantId {
    return ConversationParticipantId.fromString(this.actorIdentityId);
  }

  public getConversationId(): ConversationId {
    return ConversationId.fromString(this.conversationId);
  }

  public getMessageId(): MessageId {
    return MessageId.fromString(this.messageId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }
}
