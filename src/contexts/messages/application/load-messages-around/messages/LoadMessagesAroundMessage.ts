import { MessageAuthorId } from '../../../domain/value-objects/MessageAuthorId';
import { MessageConversationId } from '../../../domain/value-objects/MessageConversationId';
import { MessageId } from '../../../domain/value-objects/MessageId';

export class LoadMessagesAroundMessage {
  public constructor(
    private readonly input: {
      actorIdentityId: string;
      conversationId: string;
      messageId: string;
    },
  ) {}

  public getActorIdentityId(): MessageAuthorId {
    return MessageAuthorId.fromString(this.input.actorIdentityId);
  }

  public getConversationId(): MessageConversationId {
    return MessageConversationId.fromString(this.input.conversationId);
  }

  public getMessageId(): MessageId {
    return MessageId.fromString(this.input.messageId);
  }
}
