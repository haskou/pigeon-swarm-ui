import { MessageAuthorId } from '../../../domain/value-objects/MessageAuthorId';
import { MessageConversationId } from '../../../domain/value-objects/MessageConversationId';
import { MessageId } from '../../../domain/value-objects/MessageId';
import { MessagePageLimit } from '../../../domain/value-objects/MessagePageLimit';

export class LoadMessagesMessage {
  public constructor(
    private readonly input: {
      actorIdentityId: string;
      before?: null | string;
      conversationId: string;
      limit?: number;
    },
  ) {}

  public getActorIdentityId(): MessageAuthorId {
    return MessageAuthorId.fromString(this.input.actorIdentityId);
  }

  public getBeforeMessageId(): MessageId | undefined {
    return this.input.before
      ? MessageId.fromString(this.input.before)
      : undefined;
  }

  public getConversationId(): MessageConversationId {
    return MessageConversationId.fromString(this.input.conversationId);
  }

  public getLimit(): MessagePageLimit {
    return MessagePageLimit.fromNumber(this.input.limit ?? 30);
  }
}
