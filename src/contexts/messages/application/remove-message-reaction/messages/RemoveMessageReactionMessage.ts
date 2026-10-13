import { MessageAuthorId } from '../../../domain/value-objects/MessageAuthorId';
import { MessageConversationId } from '../../../domain/value-objects/MessageConversationId';
import { MessageConversationType } from '../../../domain/value-objects/MessageConversationType';
import { MessageId } from '../../../domain/value-objects/MessageId';
import { MessageReactionEmoji } from '../../../domain/value-objects/MessageReactionEmoji';

export class RemoveMessageReactionMessage {
  public constructor(
    private readonly input: {
      authorIdentityId: string;
      conversationId: string;
      conversationType: string;
      emoji: string;
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

  public getEmoji(): MessageReactionEmoji {
    return MessageReactionEmoji.fromString(this.input.emoji);
  }

  public getMessageId(): MessageId {
    return MessageId.fromString(this.input.messageId);
  }
}
