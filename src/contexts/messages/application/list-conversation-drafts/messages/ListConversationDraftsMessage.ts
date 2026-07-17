import { MessageAuthorId } from '../../../domain/value-objects/MessageAuthorId';

export class ListConversationDraftsMessage {
  public constructor(private readonly actorIdentityId: string) {}

  public getActorIdentityId(): MessageAuthorId {
    return MessageAuthorId.fromString(this.actorIdentityId);
  }
}
