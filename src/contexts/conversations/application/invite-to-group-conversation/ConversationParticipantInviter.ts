import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';

import { InviteConversationParticipantMessage } from './messages/InviteConversationParticipantMessage';

export class ConversationParticipantInviter {
  public constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

  public async invite(
    message: InviteConversationParticipantMessage,
  ): Promise<void> {
    const conversation = await this.conversationRepository.find(
      message.getConversationId(),
      message.getActorIdentityId(),
    );
    const recipientIdentityId = message.getRecipientIdentityId();

    conversation.invite(recipientIdentityId, message.getOccurredAt());
    await this.conversationRepository.invite(
      conversation,
      recipientIdentityId,
      message.getActorIdentityId(),
    );
  }
}
