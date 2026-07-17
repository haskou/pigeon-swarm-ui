import { Timestamp } from '@haskou/value-objects';

import { MessageAuthorId } from '../../../domain/value-objects/MessageAuthorId';
import { MessageContent } from '../../../domain/value-objects/MessageContent';
import { MessageConversationId } from '../../../domain/value-objects/MessageConversationId';

export class SaveConversationDraftMessage {
  public constructor(
    private readonly input: {
      authorIdentityId: string;
      content: string;
      conversationId: string;
      updatedAt: number;
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

  public getUpdatedAt(): Timestamp {
    return new Timestamp(this.input.updatedAt);
  }
}
