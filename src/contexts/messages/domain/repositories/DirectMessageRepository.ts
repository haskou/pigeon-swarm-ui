import type { MessagePinChange } from '../MessagePinChange';
import type { MessageReactionChange } from '../MessageReactionChange';
import type { MessageAuthorId } from '../value-objects/MessageAuthorId';
import type { MessageConversationId } from '../value-objects/MessageConversationId';
import type { MessageId } from '../value-objects/MessageId';

/**
 * Writes on one-to-one messages. They live in the direct mailboxes of both
 * participants, so the node keeps no aggregate to load and save.
 */
export interface DirectMessageRepository {
  delete(
    conversationId: MessageConversationId,
    messageId: MessageId,
    actorId: MessageAuthorId,
  ): Promise<void>;
  pin(
    conversationId: MessageConversationId,
    change: MessagePinChange,
    actorId: MessageAuthorId,
  ): Promise<void>;
  react(
    conversationId: MessageConversationId,
    change: MessageReactionChange,
    actorId: MessageAuthorId,
  ): Promise<void>;
}
