import type {
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ListConversationsPort } from '../ports/ListConversationsPort';

import { ConversationTimeline } from './ConversationTimeline';
import { ListConversationsMessage } from './messages/ListConversationsMessage';

export class ListConversations {
  public constructor(private readonly conversations: ListConversationsPort) {}

  private async withRecoveredActivityTimestamps(
    session: Session,
    conversations: ConversationResource[],
  ): Promise<ConversationResource[]> {
    const conversationsWithoutTimestamp = conversations.filter(
      (conversation) => conversation.latestMessageAt === undefined,
    );

    if (conversationsWithoutTimestamp.length === 0) return conversations;

    const recoveredTimestamps = new Map(
      await Promise.all(
        conversationsWithoutTimestamp.map(
          async (
            conversation,
          ): Promise<readonly [string, number | undefined]> => [
            conversation.id,
            await this.latestMessageAt(session, conversation.id),
          ],
        ),
      ),
    );

    return conversations.map((conversation) => {
      const latestMessageAt = recoveredTimestamps.get(conversation.id);

      return latestMessageAt === undefined
        ? conversation
        : { ...conversation, latestMessageAt };
    });
  }

  private async latestMessageAt(
    session: Session,
    conversationId: string,
  ): Promise<number | undefined> {
    try {
      const latestMessages = await this.conversations.loadMessages(
        session,
        conversationId,
        null,
        { limit: 1 },
      );

      return latestMessages.messages[0]?.raw.createdAt;
    } catch {
      return undefined;
    }
  }

  public async list(
    message: ListConversationsMessage,
  ): Promise<ConversationResource[]> {
    return ConversationTimeline.sortByLatestMessage(
      await this.withRecoveredActivityTimestamps(
        message.getSession(),
        await this.conversations.listConversations(message.getSession()),
      ),
    );
  }
}
