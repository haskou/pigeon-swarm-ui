import type { Conversation } from '../../domain/Conversation';
import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';

import { LeaveConversationMessage } from './messages/LeaveConversationMessage';

export class ConversationLeaver {
  public constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

  public async leave(message: LeaveConversationMessage): Promise<Conversation> {
    const conversation = await this.conversationRepository.find(
      message.getConversationId(),
      message.getActorIdentityId(),
    );

    conversation.leave(message.getActorIdentityId(), message.getOccurredAt());

    return await this.conversationRepository.leave(
      conversation,
      message.getActorIdentityId(),
    );
  }
}
