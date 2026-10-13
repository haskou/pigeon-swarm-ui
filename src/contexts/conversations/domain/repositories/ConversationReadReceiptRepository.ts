import type { ConversationId } from '../value-objects/ConversationId';
import type { ConversationParticipantId } from '../value-objects/ConversationParticipantId';
import type { MessageId } from '../value-objects/MessageId';

/**
 * Delivers the read state of a one-to-one conversation as a read record in the
 * reader's own inbox. One-to-one reads never use the conversation read-until
 * endpoint.
 */
export interface ConversationReadReceiptRepository {
  markRead(
    conversationId: ConversationId,
    messageId: MessageId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<void>;
}
