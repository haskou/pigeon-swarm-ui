import { ConversationId } from '../../../../conversations/domain/value-objects/ConversationId';
import { IdentityId } from '../../../domain/value-objects/IdentityId';

export class StopSharingContactPresenceMessage {
  public constructor(
    private readonly actorIdentityId: string,
    private readonly conversationId: string,
    private readonly contactIdentityId: string,
  ) {}

  public getActorIdentityId(): IdentityId {
    return IdentityId.fromString(this.actorIdentityId);
  }

  public getContactIdentityId(): IdentityId {
    return IdentityId.fromString(this.contactIdentityId);
  }

  public getConversationId(): ConversationId {
    return ConversationId.fromString(this.conversationId);
  }
}
