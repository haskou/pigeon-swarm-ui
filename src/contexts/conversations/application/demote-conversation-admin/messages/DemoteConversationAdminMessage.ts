import { Timestamp } from '@haskou/value-objects';

import { ConversationId } from '../../../domain/value-objects/ConversationId';
import { ConversationParticipantId } from '../../../domain/value-objects/ConversationParticipantId';

export class DemoteConversationAdminMessage {
  public constructor(
    private readonly conversationId: string,
    private readonly targetIdentityId: string,
    private readonly actorIdentityId: string,
    private readonly occurredAt: number,
  ) {}

  public getActorIdentityId(): ConversationParticipantId {
    return ConversationParticipantId.fromString(this.actorIdentityId);
  }

  public getConversationId(): ConversationId {
    return ConversationId.fromString(this.conversationId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getTargetIdentityId(): ConversationParticipantId {
    return ConversationParticipantId.fromString(this.targetIdentityId);
  }
}
