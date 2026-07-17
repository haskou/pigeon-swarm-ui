import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';

import { Conversation } from '../../domain/Conversation';
import { ConversationIdFactory } from '../../domain/ConversationIdFactory';
import { ConversationName } from '../../domain/value-objects/ConversationName';
import { ConversationType } from '../../domain/value-objects/ConversationType';
import { CreateConversationMessage } from './messages/CreateConversationMessage';

export class ConversationCreator {
  public constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationIdFactory: ConversationIdFactory,
  ) {}

  public async create(
    message: CreateConversationMessage,
  ): Promise<Conversation> {
    const actorIdentityId = message.getActorIdentityId();
    const peerIdentityId = message.getPeerIdentityId();
    const networkId = message.getNetworkId();
    const conversation = Conversation.create(
      this.conversationIdFactory.create(
        actorIdentityId,
        peerIdentityId,
        networkId,
      ),
      networkId,
      ConversationType.ONE_TO_ONE,
      ConversationName.fromOptional(),
      [actorIdentityId, peerIdentityId],
      message.getOccurredAt(),
      peerIdentityId,
    );

    return await this.conversationRepository.create(
      conversation,
      actorIdentityId,
    );
  }
}
