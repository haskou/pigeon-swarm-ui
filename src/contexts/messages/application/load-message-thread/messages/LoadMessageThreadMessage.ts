import { MessageAuthorId } from '../../../domain/value-objects/MessageAuthorId';
import { MessageConversationId } from '../../../domain/value-objects/MessageConversationId';
import { MessageId } from '../../../domain/value-objects/MessageId';
import { MessagePageLimit } from '../../../domain/value-objects/MessagePageLimit';

export class LoadMessageThreadMessage {
  public constructor(
    private readonly input: {
      actorIdentityId: string;
      conversationId: string;
      limit?: number;
      messageId: string;
    },
  ) {}

  public getActorIdentityId(): MessageAuthorId {
    return MessageAuthorId.fromString(this.input.actorIdentityId);
  }

  public getConversationId(): MessageConversationId {
    return MessageConversationId.fromString(this.input.conversationId);
  }

  public getLimit(): MessagePageLimit {
    return MessagePageLimit.fromNumber(this.input.limit ?? 50);
  }

  public getMessageId(): MessageId {
    return MessageId.fromString(this.input.messageId);
  }
}
