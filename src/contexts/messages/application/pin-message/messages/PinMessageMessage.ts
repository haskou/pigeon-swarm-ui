import { MessageAuthorId } from '../../../domain/value-objects/MessageAuthorId';
import { MessageConversationId } from '../../../domain/value-objects/MessageConversationId';
import { MessageConversationType } from '../../../domain/value-objects/MessageConversationType';
import { MessageId } from '../../../domain/value-objects/MessageId';

export class PinMessageMessage {
  public constructor(
    private readonly input: {
      authorIdentityId: string;
      conversationId: string;
      conversationType: string;
      messageId: string;
    },
  ) {}

  public getAuthorId(): MessageAuthorId {
    return MessageAuthorId.fromString(this.input.authorIdentityId);
  }

  public getConversationId(): MessageConversationId {
    return MessageConversationId.fromString(this.input.conversationId);
  }

  public getConversationType(): MessageConversationType {
    return MessageConversationType.fromPrimitives(this.input.conversationType);
  }

  public getMessageId(): MessageId {
    return MessageId.fromString(this.input.messageId);
  }
}
