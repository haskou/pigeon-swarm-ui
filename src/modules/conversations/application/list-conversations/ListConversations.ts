import type { ConversationResource } from '../../../../shared/domain/pigeonResources.types';
import type { ListConversationsPort } from '../ports/ListConversationsPort';

import { ConversationTimeline } from '../../domain/ConversationTimeline';
import { ListConversationsMessage } from './messages/ListConversationsMessage';

export class ListConversations {
  public constructor(private readonly conversations: ListConversationsPort) {}

  public async list(
    message: ListConversationsMessage,
  ): Promise<ConversationResource[]> {
    return ConversationTimeline.sortByLatestMessage(
      await this.conversations.listConversations(message.getSession()),
    );
  }
}
