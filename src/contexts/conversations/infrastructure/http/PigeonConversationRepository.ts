import { assert } from '@haskou/value-objects';

import type { LocalKeychain } from '../../../../shared/domain/pigeonResources.types';
import type { PigeonMessagesGateway } from '../../../messages/infrastructure/http/PigeonMessagesGateway';
import type { Conversation } from '../../domain/Conversation';
import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';
import type { ConversationGroupNonce } from '../../domain/value-objects/ConversationGroupNonce';
import type { ConversationId } from '../../domain/value-objects/ConversationId';
import type { ConversationParticipantId } from '../../domain/value-objects/ConversationParticipantId';
import type { MessageId } from '../../domain/value-objects/MessageId';

import { ConversationNotFoundError } from '../../domain/errors/ConversationNotFoundError';
import { ConversationParticipantNotFoundError } from '../../domain/errors/ConversationParticipantNotFoundError';
import { ConversationAccessContexts } from './ConversationAccessContexts';
import { ConversationMapper } from './ConversationMapper';
import { ConversationTarget } from './ConversationTarget';
import { PigeonConversationsGateway } from './PigeonConversationsGateway';

export class PigeonConversationRepository implements ConversationRepository {
  public constructor(
    private readonly gateway: PigeonConversationsGateway,
    private readonly messagesGateway: PigeonMessagesGateway,
    private readonly contexts: ConversationAccessContexts,
    private readonly mapper: ConversationMapper,
  ) {}

  private async recoverLatestMessageAt(
    conversation: Conversation,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation> {
    const primitives = conversation.toPrimitives();

    if (primitives.latestMessageAt !== undefined) return conversation;

    try {
      const result = await this.messagesGateway.loadMessages(
        this.contexts.find(actorIdentityId),
        primitives.id,
        null,
        { limit: 1 },
      );
      const latestMessageAt = result.messages[0]?.raw.createdAt;

      return latestMessageAt === undefined
        ? conversation
        : this.mapper.fromPrimitives({
            ...this.mapper.toResource(conversation),
            latestMessageAt,
          });
    } catch {
      return conversation;
    }
  }

  private targetOf(conversation: Conversation): ConversationTarget {
    const { id, networkId } = this.mapper.toResource(conversation);

    return { id, networkId };
  }

  private updateContext(
    actorIdentityId: ConversationParticipantId,
    keychain: LocalKeychain,
    keychainExternalIdentifier: string,
  ): void {
    const session = this.contexts.find(actorIdentityId);

    this.contexts.replace(actorIdentityId, {
      ...session,
      keychain,
      keychainExternalIdentifier,
    });
  }

  private completeCreation(
    result: Awaited<
      ReturnType<PigeonConversationsGateway['createConversation']>
    >,
    actorIdentityId: ConversationParticipantId,
  ): Conversation {
    this.updateContext(
      actorIdentityId,
      result.keychain,
      result.keychainExternalIdentifier,
    );

    return this.mapper.fromPrimitives(result.conversation);
  }

  public async create(
    conversation: Conversation,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation> {
    const resource = this.mapper.toResource(conversation);
    const peerIdentityId = conversation.peerOf(actorIdentityId);

    assert(peerIdentityId, new ConversationParticipantNotFoundError());

    return this.completeCreation(
      await this.gateway.createConversation(
        this.contexts.find(actorIdentityId),
        peerIdentityId.toString(),
        resource.networkId,
      ),
      actorIdentityId,
    );
  }

  public async createGroup(
    conversation: Conversation,
    nonce: ConversationGroupNonce,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation> {
    const resource = this.mapper.toResource(conversation);

    return this.completeCreation(
      await this.gateway.createGroupConversation(
        this.contexts.find(actorIdentityId),
        {
          name: resource.name ?? '',
          networkId: resource.networkId,
          nonce: nonce.toString(),
          participantIds: resource.participantIds,
        },
      ),
      actorIdentityId,
    );
  }

  public async demoteAdmin(
    conversation: Conversation,
    targetIdentityId: ConversationParticipantId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation> {
    return this.mapper.fromPrimitives(
      await this.gateway.demoteGroupAdmin(
        this.contexts.find(actorIdentityId),
        this.targetOf(conversation),
        targetIdentityId.toString(),
      ),
    );
  }

  public async find(
    conversationId: ConversationId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation> {
    const conversation = (await this.searchByIdentity(actorIdentityId)).find(
      (candidate) => candidate.belongsTo(conversationId),
    );

    assert(conversation, new ConversationNotFoundError());

    return conversation;
  }

  public async invite(
    conversation: Conversation,
    recipientIdentityId: ConversationParticipantId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation> {
    return this.mapper.fromPrimitives(
      await this.gateway.addGroupMember(
        this.contexts.find(actorIdentityId),
        this.targetOf(conversation),
        recipientIdentityId.toString(),
      ),
    );
  }

  public async leave(
    conversation: Conversation,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation> {
    return this.mapper.fromPrimitives(
      await this.gateway.leaveGroupConversation(
        this.contexts.find(actorIdentityId),
        this.targetOf(conversation),
      ),
    );
  }

  public async markReadUntil(
    conversation: Conversation,
    messageId: MessageId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<void> {
    await this.gateway.markConversationReadUntil(
      this.contexts.find(actorIdentityId),
      this.mapper.toResource(conversation).id,
      messageId.toString(),
    );
  }

  public async promoteAdmin(
    conversation: Conversation,
    targetIdentityId: ConversationParticipantId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation> {
    return this.mapper.fromPrimitives(
      await this.gateway.promoteGroupAdmin(
        this.contexts.find(actorIdentityId),
        this.targetOf(conversation),
        targetIdentityId.toString(),
      ),
    );
  }

  public async removeParticipant(
    conversation: Conversation,
    targetIdentityId: ConversationParticipantId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<Conversation> {
    return this.mapper.fromPrimitives(
      await this.gateway.removeGroupMember(
        this.contexts.find(actorIdentityId),
        this.targetOf(conversation),
        targetIdentityId.toString(),
      ),
    );
  }

  public async searchByIdentity(
    identityId: ConversationParticipantId,
  ): Promise<Conversation[]> {
    const conversations = (
      await this.gateway.listConversations(this.contexts.find(identityId))
    ).map((resource) => this.mapper.fromPrimitives(resource));

    const recovered = await Promise.all(
      conversations.map(
        async (conversation) =>
          await this.recoverLatestMessageAt(conversation, identityId),
      ),
    );

    return recovered.sort((left, right) => {
      if (left.isMoreRecentThan(right)) return -1;

      if (right.isMoreRecentThan(left)) return 1;

      return 0;
    });
  }
}
