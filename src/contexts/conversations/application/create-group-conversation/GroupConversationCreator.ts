import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';

import { Conversation } from '../../domain/Conversation';
import { ConversationIdFactory } from '../../domain/ConversationIdFactory';
import { ConversationGroupNonce } from '../../domain/value-objects/ConversationGroupNonce';
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
    const networkId = message.getNetworkId();
    const nonce = ConversationGroupNonce.generate();
    const conversation = Conversation.create(
      this.conversationIdFactory.createGroup(actorIdentityId, networkId, nonce),
      networkId,
      ConversationType.GROUP,
      message.getName(),
      [actorIdentityId, ...message.getParticipantIds()],
      actorIdentityId,
      message.getOccurredAt(),
    );

    return await this.conversationRepository.createGroup(
      conversation,
      nonce,
      actorIdentityId,
    );
  }
}
