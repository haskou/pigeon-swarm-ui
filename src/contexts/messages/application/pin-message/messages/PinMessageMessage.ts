import { Timestamp } from '@haskou/value-objects';

import { MessageAuthorId } from '../../../domain/value-objects/MessageAuthorId';
import { MessageConversationId } from '../../../domain/value-objects/MessageConversationId';
import { MessageId } from '../../../domain/value-objects/MessageId';

export class PinMessageMessage {
  public constructor(
    private readonly input: {
      authorIdentityId: string;
      conversationId: string;
      messageId: string;
      occurredAt: number;
    },
  ) {}

  public getAuthorId(): MessageAuthorId {
    return MessageAuthorId.fromString(this.input.authorIdentityId);
  }

  public getConversationId(): MessageConversationId {
    return MessageConversationId.fromString(this.input.conversationId);
  }

  public getMessageId(): MessageId {
    return MessageId.fromString(this.input.messageId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.input.occurredAt);
  }
}
