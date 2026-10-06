import type { Conversation } from '../../domain/Conversation';
import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';

import { PromoteConversationAdminMessage } from './messages/PromoteConversationAdminMessage';

export class ConversationAdminPromoter {
  public constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

  public async promote(message: PromoteConversationAdminMessage): Promise<Conversation> {
    const conversation = await this.conversationRepository.find(
      message.getConversationId(),
      message.getActorIdentityId(),
    );

    conversation.promote(
      message.getTargetIdentityId(),
      message.getActorIdentityId(),
      message.getOccurredAt(),
    );

    return await this.conversationRepository.promoteAdmin(
      conversation,
      message.getTargetIdentityId(),
      message.getActorIdentityId(),
    );
  }
}
