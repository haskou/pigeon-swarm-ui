import { MessageAuthorId } from '../../../domain/value-objects/MessageAuthorId';
import { MessageConversationId } from '../../../domain/value-objects/MessageConversationId';

export class ListMessagePinsMessage {
  public constructor(
    private readonly input: {
      actorIdentityId: string;
      conversationId: string;
    },
  ) {}

  public getActorIdentityId(): MessageAuthorId {
    return MessageAuthorId.fromString(this.input.actorIdentityId);
  }

  public getConversationId(): MessageConversationId {
    return MessageConversationId.fromString(this.input.conversationId);
  }
}
