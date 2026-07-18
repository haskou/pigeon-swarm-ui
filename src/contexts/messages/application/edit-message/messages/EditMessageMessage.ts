import { Timestamp } from '@haskou/value-objects';

import { MessageAuthorId } from '../../../domain/value-objects/MessageAuthorId';
import { MessageContent } from '../../../domain/value-objects/MessageContent';
import { MessageConversationId } from '../../../domain/value-objects/MessageConversationId';
import { MessageId } from '../../../domain/value-objects/MessageId';

export class EditMessageMessage {
  public constructor(
    private readonly input: {
      authorIdentityId: string;
      content: string;
      conversationId: string;
      messageId: string;
      occurredAt: number;
    },
  ) {}

  public getAuthorId(): MessageAuthorId {
    return MessageAuthorId.fromString(this.input.authorIdentityId);
  }

  public getContent(): MessageContent {
    return MessageContent.fromString(this.input.content);
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
