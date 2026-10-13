import { Timestamp } from '@haskou/value-objects';

import { ConversationId } from '../../../domain/value-objects/ConversationId';
import { ConversationParticipantId } from '../../../domain/value-objects/ConversationParticipantId';
import { ConversationType } from '../../../domain/value-objects/ConversationType';
import { MessageId } from '../../../domain/value-objects/MessageId';

export class MarkConversationReadUntilMessage {
  public constructor(
    private readonly conversationId: string,
    private readonly messageId: string,
    private readonly actorIdentityId: string,
    private readonly occurredAt: number,
    /** The conversation the reader has open, when the client holds one. */
    private readonly openConversation: null | {
      id: string;
      type: string;
    } = null,
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

  public getOpenConversation(): null | {
    id: ConversationId;
    type: ConversationType;
  } {
    if (!this.openConversation) return null;

    return {
      id: ConversationId.fromString(this.openConversation.id),
      type: ConversationType.fromPrimitives(this.openConversation.type),
    };
  }
}
