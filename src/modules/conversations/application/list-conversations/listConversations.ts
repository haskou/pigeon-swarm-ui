import type { ConversationResource, Session } from '../../../../shared/domain/pigeonResources.types';

import { sortConversationsByLatestMessage } from '../../domain/conversationOrdering';
import { PigeonApiGateway } from '../../../../app/composition/pigeonApiGateway';

export class ListConversations {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(session: Session): Promise<ConversationResource[]> {
    return sortConversationsByLatestMessage(
      await this.withLatestMessageActivity(
        session,
        await this.gateway.listConversations(session),
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
          const { messages } = await this.gateway.loadMessages(
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
