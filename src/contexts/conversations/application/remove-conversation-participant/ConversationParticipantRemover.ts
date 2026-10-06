import type { Conversation } from '../../domain/Conversation';
import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';

import { RemoveConversationParticipantMessage } from './messages/RemoveConversationParticipantMessage';

export class ConversationParticipantRemover {
  public constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

  public async remove(
    message: RemoveConversationParticipantMessage,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.find(
      message.getConversationId(),
      message.getActorIdentityId(),
    );

    conversation.removeParticipant(
      message.getTargetIdentityId(),
      message.getActorIdentityId(),
      message.getOccurredAt(),
    );

    return await this.conversationRepository.removeParticipant(
      conversation,
      message.getTargetIdentityId(),
      message.getActorIdentityId(),
    );
  }
}
