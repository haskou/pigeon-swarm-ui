import type { Conversation } from '../../../contexts/conversations/domain/Conversation';
import type {
  ConversationResource,
  LocalKeychain,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { ConversationUseCases } from './ConversationUseCases';

import { CreateConversationMessage } from '../../../contexts/conversations/application/create-conversation/messages/CreateConversationMessage';
import { CreateGroupConversationMessage } from '../../../contexts/conversations/application/create-group-conversation/messages/CreateGroupConversationMessage';
import { InviteConversationParticipantMessage } from '../../../contexts/conversations/application/invite-to-group-conversation/messages/InviteConversationParticipantMessage';
import { MarkConversationReadUntilMessage } from '../../../contexts/conversations/application/mark-conversation-read-until/messages/MarkConversationReadUntilMessage';
import { SearchConversationsMessage } from '../../../contexts/conversations/application/search-conversations/messages/SearchConversationsMessage';
import { ConversationParticipantId } from '../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { ConversationAccessContexts } from '../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import { ConversationMapper } from '../../../contexts/conversations/infrastructure/http/ConversationMapper';
import { ConversationKeychainPublicationMissingError } from '../../../contexts/conversations/infrastructure/http/errors/ConversationKeychainPublicationMissingError';

export class PigeonConversationsFacade {
  public constructor(
    private readonly contexts: ConversationAccessContexts,
    private readonly mapper: ConversationMapper,
    private readonly useCases: ConversationUseCases,
  ) {}

  private actor(session: Session): string {
    this.contexts.register(session);

    return session.identity.id;
  }

  private creationResult(
    actorIdentityId: string,
    conversation: Conversation,
  ): {
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  } {
    const session = this.contexts.find(
      ConversationParticipantId.fromString(actorIdentityId),
    );

    if (!session.keychainExternalIdentifier) {
      throw new ConversationKeychainPublicationMissingError();
    }

    return {
      conversation: this.mapper.toResource(conversation),
      keychain: session.keychain,
      keychainExternalIdentifier: session.keychainExternalIdentifier,
    };
  }

  public async create(
    session: Session,
    peerIdentityId: string,
    networkId: string,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const actorIdentityId = this.actor(session);
    const conversation = await this.useCases.creator.create(
      new CreateConversationMessage(
        networkId,
        peerIdentityId,
        actorIdentityId,
        Date.now(),
      ),
    );

    return this.creationResult(actorIdentityId, conversation);
  }

  public async createGroup(
    session: Session,
    input: { name: string; networkId: string; participantIds: string[] },
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const actorIdentityId = this.actor(session);
    const conversation = await this.useCases.groupCreator.create(
      new CreateGroupConversationMessage(
        input.name,
        input.networkId,
        input.participantIds,
        actorIdentityId,
        Date.now(),
      ),
    );

    return this.creationResult(actorIdentityId, conversation);
  }

  public async inviteToGroup(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    await this.useCases.participantInviter.invite(
      new InviteConversationParticipantMessage(
        conversationId,
        recipientIdentityId,
        this.actor(session),
        Date.now(),
      ),
    );
  }

  public async list(session: Session): Promise<ConversationResource[]> {
    const conversations = await this.useCases.searcher.search(
      new SearchConversationsMessage(this.actor(session)),
    );

    return conversations.map((conversation) =>
      this.mapper.toResource(conversation),
    );
  }

  public async markReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.useCases.readMarker.mark(
      new MarkConversationReadUntilMessage(
        conversationId,
        messageId,
        this.actor(session),
        Date.now(),
      ),
    );
  }
}
