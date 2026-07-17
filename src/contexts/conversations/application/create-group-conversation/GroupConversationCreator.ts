import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';

import { Conversation } from '../../domain/Conversation';
import { ConversationIdFactory } from '../../domain/ConversationIdFactory';
import { ConversationType } from '../../domain/value-objects/ConversationType';
import { CreateGroupConversationMessage } from './messages/CreateGroupConversationMessage';

export class GroupConversationCreator {
  public constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationIdFactory: ConversationIdFactory,
  ) {}

  public async create(
    message: CreateGroupConversationMessage,
  ): Promise<Conversation> {
    const actorIdentityId = message.getActorIdentityId();
    const conversation = Conversation.create(
      this.conversationIdFactory.createGroup(),
      message.getNetworkId(),
      ConversationType.GROUP,
      message.getName(),
      [actorIdentityId, ...message.getParticipantIds()],
      message.getOccurredAt(),
    );

    return await this.conversationRepository.create(
      conversation,
      actorIdentityId,
    );
  }
}
