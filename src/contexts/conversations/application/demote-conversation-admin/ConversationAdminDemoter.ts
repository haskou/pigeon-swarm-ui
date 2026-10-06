import type { Conversation } from '../../domain/Conversation';
import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';

import { DemoteConversationAdminMessage } from './messages/DemoteConversationAdminMessage';

export class ConversationAdminDemoter {
  public constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

  public async demote(
    message: DemoteConversationAdminMessage,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.find(
      message.getConversationId(),
      message.getActorIdentityId(),
    );

    conversation.demote(
      message.getTargetIdentityId(),
      message.getActorIdentityId(),
      message.getOccurredAt(),
    );

    return await this.conversationRepository.demoteAdmin(
      conversation,
      message.getTargetIdentityId(),
      message.getActorIdentityId(),
    );
  }
}
