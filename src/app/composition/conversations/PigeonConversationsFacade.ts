import type { Conversation } from '../../../contexts/conversations/domain/Conversation';
import type { ConversationResource } from '../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { GroupConversationMailbox } from '../../../contexts/groupMailboxes/infrastructure/GroupConversationMailbox';
import type { LocalKeychain } from '../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { ConversationUseCases } from './ConversationUseCases';

import { CreateConversationMessage } from '../../../contexts/conversations/application/create-conversation/messages/CreateConversationMessage';
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
    private readonly groups: Pick<
      GroupConversationMailbox,
      | 'addMember'
      | 'conversations'
      | 'create'
      | 'demote'
      | 'leave'
      | 'promote'
      | 'removeMember'
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

  /**
   * Starts a group conversation on this device; the node never learns it.
   * The invitees join once they answer the key-package requests it sends.
   */
  public async createGroup(
    session: Session,
    input: { name: string; networkId: string; participantIds: string[] },
  ): Promise<ConversationResource> {
    return await this.groups.create(session, input);
  }

  /** Demotes an admin of a group conversation; only its creator may. */
  public async demoteAdmin(
    session: Session,
    conversationId: string,
    identityId: string,
  ): Promise<void> {
    await this.groups.demote(session, conversationId, identityId);
  }

  /** Adds an identity to a group conversation's roster. */
  public async inviteToGroup(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    await this.groups.addMember(session, conversationId, recipientIdentityId);
  }

  /** Takes this identity off a group conversation's roster. */
  public async leave(session: Session, conversationId: string): Promise<void> {
    await this.groups.leave(session, conversationId);
  }

  /**
   * The node's one-to-one conversations, then the group conversations this
   * device holds.
   */
  public async list(session: Session): Promise<ConversationResource[]> {
    const [conversations, groups] = await Promise.all([
      this.useCases.searcher.search(
        new SearchConversationsMessage(this.actor(session)),
      ),
      this.groups.conversations(session),
    ]);

    return [
      ...conversations.map((conversation) =>
        this.mapper.toResource(conversation),
      ),
      ...groups,
    ];
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

  /** Promotes a member of a group conversation; only its creator may. */
  public async promoteAdmin(
    session: Session,
    conversationId: string,
    identityId: string,
  ): Promise<void> {
    await this.groups.promote(session, conversationId, identityId);
  }

  /** Removes a member from a group conversation's roster. */
  public async removeParticipant(
    session: Session,
    conversationId: string,
    identityId: string,
  ): Promise<void> {
    await this.groups.removeMember(session, conversationId, identityId);
  }
}
