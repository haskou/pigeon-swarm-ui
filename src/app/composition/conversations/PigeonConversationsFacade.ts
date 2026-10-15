import type { Conversation } from '../../../contexts/conversations/domain/Conversation';
import type { ConversationResource } from '../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { GroupConversationMailbox } from '../../../contexts/groupMailboxes/infrastructure/GroupConversationMailbox';
import type { LocalKeychain } from '../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { ConversationUseCases } from './ConversationUseCases';

import { CreateConversationMessage } from '../../../contexts/conversations/application/create-conversation/messages/CreateConversationMessage';
import { CreateGroupConversationMessage } from '../../../contexts/conversations/application/create-group-conversation/messages/CreateGroupConversationMessage';
import { DemoteConversationAdminMessage } from '../../../contexts/conversations/application/demote-conversation-admin/messages/DemoteConversationAdminMessage';
import { InviteConversationParticipantMessage } from '../../../contexts/conversations/application/invite-to-group-conversation/messages/InviteConversationParticipantMessage';
import { LeaveConversationMessage } from '../../../contexts/conversations/application/leave-conversation/messages/LeaveConversationMessage';
import { MarkConversationReadUntilMessage } from '../../../contexts/conversations/application/mark-conversation-read-until/messages/MarkConversationReadUntilMessage';
import { PromoteConversationAdminMessage } from '../../../contexts/conversations/application/promote-conversation-admin/messages/PromoteConversationAdminMessage';
import { RemoveConversationParticipantMessage } from '../../../contexts/conversations/application/remove-conversation-participant/messages/RemoveConversationParticipantMessage';
import { SearchConversationsMessage } from '../../../contexts/conversations/application/search-conversations/messages/SearchConversationsMessage';
import { ConversationGroupNonce } from '../../../contexts/conversations/domain/value-objects/ConversationGroupNonce';
import { ConversationParticipantId } from '../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { ConversationAccessContexts } from '../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import { ConversationMapper } from '../../../contexts/conversations/infrastructure/http/ConversationMapper';
import { ConversationKeychainPublicationMissingError } from '../../../contexts/conversations/infrastructure/http/errors/ConversationKeychainPublicationMissingError';

export class PigeonConversationsFacade {
  public constructor(
    private readonly contexts: ConversationAccessContexts,
    private readonly mapper: ConversationMapper,
    private readonly useCases: ConversationUseCases,
    private readonly groups: Pick<
      GroupConversationMailbox,
      'create' | 'membersChanged'
    >,
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
    const message = new CreateGroupConversationMessage(
      input.name,
      input.networkId,
      input.participantIds,
      actorIdentityId,
      ConversationGroupNonce.generate().toString(),
      Date.now(),
    );
    const conversation = await this.useCases.groupCreator.create(message);

    // The genesis the id derives from names this identity as creator.
    await this.groups.create(session, conversation.toPrimitives().id, {
      creatorIdentityId: message.getActorIdentityId().toString(),
      networkId: message.getNetworkId().toString(),
      nonce: message.getNonce().toString(),
    });

    return this.creationResult(actorIdentityId, conversation);
  }

  public async demoteAdmin(
    session: Session,
    conversationId: string,
    identityId: string,
  ): Promise<ConversationResource> {
    return this.mapper.toResource(
      await this.useCases.adminDemoter.demote(
        new DemoteConversationAdminMessage(
          conversationId,
          identityId,
          this.actor(session),
          Date.now(),
        ),
      ),
    );
  }

  public async inviteToGroup(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<ConversationResource> {
    const conversation = await this.useCases.participantInviter.invite(
      new InviteConversationParticipantMessage(
        conversationId,
        recipientIdentityId,
        this.actor(session),
        Date.now(),
      ),
    );

    void this.groups.membersChanged(session, conversationId);

    return this.mapper.toResource(conversation);
  }

  public async leave(
    session: Session,
    conversationId: string,
  ): Promise<ConversationResource> {
    return this.mapper.toResource(
      await this.useCases.leaver.leave(
        new LeaveConversationMessage(
          conversationId,
          this.actor(session),
          Date.now(),
        ),
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

  /**
   * Marks a conversation read up to a message. The reader's open
   * conversation, if any, lets the read use case send a one-to-one read
   * through the reader's own inbox.
   */
  public async markReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
    openConversation?: ConversationResource,
  ): Promise<void> {
    if (openConversation) this.contexts.registerOpen(openConversation);

    await this.useCases.readMarker.mark(
      new MarkConversationReadUntilMessage(
        conversationId,
        messageId,
        this.actor(session),
        openConversation
          ? { id: openConversation.id, type: openConversation.type }
          : null,
      ),
    );
  }

  public async promoteAdmin(
    session: Session,
    conversationId: string,
    identityId: string,
  ): Promise<ConversationResource> {
    return this.mapper.toResource(
      await this.useCases.adminPromoter.promote(
        new PromoteConversationAdminMessage(
          conversationId,
          identityId,
          this.actor(session),
          Date.now(),
        ),
      ),
    );
  }

  public async removeParticipant(
    session: Session,
    conversationId: string,
    identityId: string,
  ): Promise<ConversationResource> {
    const conversation = await this.useCases.participantRemover.remove(
      new RemoveConversationParticipantMessage(
        conversationId,
        identityId,
        this.actor(session),
        Date.now(),
      ),
    );

    void this.groups.membersChanged(session, conversationId);

    return this.mapper.toResource(conversation);
  }
}
