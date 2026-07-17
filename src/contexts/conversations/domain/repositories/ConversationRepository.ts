import type { Conversation } from '../Conversation';
import type { ConversationId } from '../value-objects/ConversationId';
import type { ConversationParticipantId } from '../value-objects/ConversationParticipantId';
import type { MessageId } from '../value-objects/MessageId';

export interface ConversationRepository {
  create(
    conversation: Conversation,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation>;
  find(
    conversationId: ConversationId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation>;
  invite(
    conversation: Conversation,
    recipientIdentityId: ConversationParticipantId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<void>;
  markReadUntil(
    conversation: Conversation,
    messageId: MessageId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<void>;
  searchByIdentity(
    identityId: ConversationParticipantId,
  ): Promise<Conversation[]>;
}
