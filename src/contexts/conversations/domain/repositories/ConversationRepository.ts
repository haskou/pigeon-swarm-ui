import type { Conversation } from '../Conversation';
import type { ConversationGroupNonce } from '../value-objects/ConversationGroupNonce';
import type { ConversationId } from '../value-objects/ConversationId';
import type { ConversationParticipantId } from '../value-objects/ConversationParticipantId';
import type { MessageId } from '../value-objects/MessageId';

export interface ConversationRepository {
  create(
    conversation: Conversation,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation>;
  createGroup(
    conversation: Conversation,
    nonce: ConversationGroupNonce,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation>;
  demoteAdmin(
    conversation: Conversation,
    targetIdentityId: ConversationParticipantId,
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
  ): Promise<Conversation>;
  leave(
    conversation: Conversation,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation>;
  markReadUntil(
    conversation: Conversation,
    messageId: MessageId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<void>;
  promoteAdmin(
    conversation: Conversation,
    targetIdentityId: ConversationParticipantId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation>;
  removeParticipant(
    conversation: Conversation,
    targetIdentityId: ConversationParticipantId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation>;
  searchByIdentity(
    identityId: ConversationParticipantId,
  ): Promise<Conversation[]>;
}
