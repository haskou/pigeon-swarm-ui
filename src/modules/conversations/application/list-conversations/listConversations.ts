import type {
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ListConversationsPort } from '../ports/listConversationsPort';

import { ConversationTimeline } from '../../domain/conversationOrdering';
import { ListConversationsMessage } from './messages/listConversationsMessage';

export class ListConversations {
  public constructor(private readonly conversations: ListConversationsPort) {}

  public async list(
    message: ListConversationsMessage,
  ): Promise<ConversationResource[]> {
    const session = message.getSession();

    return ConversationTimeline.sortByLatestMessage(
      await this.withLatestMessageActivity(
        session,
        await this.conversations.listConversations(session),
      ),
    );
  }

  private async withLatestMessageActivity(
    session: Session,
    conversations: ConversationResource[],
  ): Promise<ConversationResource[]> {
    return await Promise.all(
      conversations.map(async (conversation) => {
        if (conversation.latestMessageAt) return conversation;

        try {
          const { messages } = await this.conversations.loadMessages(
            session,
            conversation.id,
            null,
            1,
          );
          const latestMessage = messages[messages.length - 1];

          return latestMessage
            ? { ...conversation, latestMessageAt: latestMessage.timestamp }
            : conversation;
        } catch {
          return conversation;
        }
      }),
    );
  }
}
