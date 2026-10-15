import type { Conversation } from '../Conversation';
import type { ConversationParticipantId } from '../value-objects/ConversationParticipantId';

export interface ConversationRepository {
  create(
    conversation: Conversation,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation>;
  searchByIdentity(
    identityId: ConversationParticipantId,
  ): Promise<Conversation[]>;
}
