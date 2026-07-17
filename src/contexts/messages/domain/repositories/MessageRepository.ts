import type { PinnedMessage } from '../entities/PinnedMessage';
import type { Message } from '../Message';
import type { MessagePage } from '../MessagePage';
import type { MessageAuthorId } from '../value-objects/MessageAuthorId';
import type { MessageConversationId } from '../value-objects/MessageConversationId';
import type { MessageId } from '../value-objects/MessageId';
import type { MessagePageLimit } from '../value-objects/MessagePageLimit';

export interface MessageRepository {
  create(message: Message): Promise<Message>;
  find(
    conversationId: MessageConversationId,
    messageId: MessageId,
    actorIdentityId: MessageAuthorId,
  ): Promise<Message>;
  save(message: Message, actorIdentityId: MessageAuthorId): Promise<Message>;
  search(
    conversationId: MessageConversationId,
    actorIdentityId: MessageAuthorId,
    before: MessageId | undefined,
    limit: MessagePageLimit,
  ): Promise<MessagePage>;
  searchAround(
    conversationId: MessageConversationId,
    messageId: MessageId,
    actorIdentityId: MessageAuthorId,
  ): Promise<MessagePage>;
  searchPinned(
    conversationId: MessageConversationId,
    actorIdentityId: MessageAuthorId,
  ): Promise<PinnedMessage[]>;
  searchThread(
    conversationId: MessageConversationId,
    rootMessageId: MessageId,
    actorIdentityId: MessageAuthorId,
    limit: MessagePageLimit,
  ): Promise<MessagePage>;
}
