import { ConversationParticipantId } from '../../../domain/value-objects/ConversationParticipantId';

export class SearchConversationsMessage {
  public constructor(private readonly identityId: string) {}

  public getIdentityId(): ConversationParticipantId {
    return ConversationParticipantId.fromString(this.identityId);
  }
}
