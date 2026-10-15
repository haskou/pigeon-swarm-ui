import { assert } from '@haskou/value-objects';

import type { LocalKeychain } from '../../../identities/infrastructure/keychain/LocalKeychain';
import type { Conversation } from '../../domain/Conversation';
import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';
import type { ConversationParticipantId } from '../../domain/value-objects/ConversationParticipantId';

import { ConversationParticipantNotFoundError } from '../../domain/errors/ConversationParticipantNotFoundError';
import { ConversationAccessContexts } from './ConversationAccessContexts';
import { ConversationMapper } from './ConversationMapper';
import { PigeonConversationsGateway } from './PigeonConversationsGateway';

export class PigeonConversationRepository implements ConversationRepository {
  public constructor(
    private readonly gateway: PigeonConversationsGateway,
    private readonly contexts: ConversationAccessContexts,
    private readonly mapper: ConversationMapper,
  ) {}

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

  public async searchByIdentity(
    identityId: ConversationParticipantId,
  ): Promise<Conversation[]> {
    return (
      await this.gateway.listConversations(this.contexts.find(identityId))
    )
      .map((resource) => this.mapper.fromPrimitives(resource))
      .sort((left, right) => {
        if (left.isMoreRecentThan(right)) return -1;

        if (right.isMoreRecentThan(left)) return 1;

        return 0;
      });
  }
}
