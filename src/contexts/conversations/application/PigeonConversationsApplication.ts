import type {
  ConversationResource,
  LocalKeychain,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { CreateConversationPort } from './create-conversation/CreateConversationPort';
import type { CreateGroupConversationPort } from './create-group-conversation/CreateGroupConversationPort';
import type { InviteToGroupConversationPort } from './invite-to-group-conversation/InviteToGroupConversationPort';
import type { ListConversationsPort } from './list-conversations/ListConversationsPort';
import type { MarkConversationReadUntilPort } from './mark-conversation-read-until/MarkConversationReadUntilPort';

import { CreateConversation } from './create-conversation/CreateConversation';
import { CreateConversationMessage } from './create-conversation/messages/CreateConversationMessage';
import {
  CreateGroupConversation,
  type CreateGroupConversationInput,
} from './create-group-conversation/CreateGroupConversation';
import { CreateGroupConversationMessage } from './create-group-conversation/messages/CreateGroupConversationMessage';
import { InviteToGroupConversation } from './invite-to-group-conversation/InviteToGroupConversation';
import { InviteToGroupConversationMessage } from './invite-to-group-conversation/messages/InviteToGroupConversationMessage';
import { ListConversations } from './list-conversations/ListConversations';
import { ListConversationsMessage } from './list-conversations/messages/ListConversationsMessage';
import { MarkConversationReadUntil } from './mark-conversation-read-until/MarkConversationReadUntil';
import { MarkConversationReadUntilMessage } from './mark-conversation-read-until/messages/MarkConversationReadUntilMessage';

export class PigeonConversationsApplication {
  private readonly createConversation: CreateConversation;

  private readonly createGroupConversation: CreateGroupConversation;

  private readonly listConversations: ListConversations;

  private readonly inviteToGroupConversation: InviteToGroupConversation;

  private readonly markConversationReadUntil: MarkConversationReadUntil;

  public constructor(dependencies: {
    createConversation: CreateConversationPort;
    createGroupConversation: CreateGroupConversationPort;
    inviteToGroupConversation: InviteToGroupConversationPort;
    listConversations: ListConversationsPort;
    markConversationReadUntil: MarkConversationReadUntilPort;
  }) {
    this.createConversation = new CreateConversation(
      dependencies.createConversation,
    );
    this.createGroupConversation = new CreateGroupConversation(
      dependencies.createGroupConversation,
    );
    this.inviteToGroupConversation = new InviteToGroupConversation(
      dependencies.inviteToGroupConversation,
    );
    this.listConversations = new ListConversations(
      dependencies.listConversations,
    );
    this.markConversationReadUntil = new MarkConversationReadUntil(
      dependencies.markConversationReadUntil,
    );
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
    return await this.createConversation.create(
      new CreateConversationMessage({ networkId, peerIdentityId, session }),
    );
  }

  public async createGroup(
    session: Session,
    input: CreateGroupConversationInput,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.createGroupConversation.create(
      new CreateGroupConversationMessage({ group: input, session }),
    );
  }

  public async inviteToGroup(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    await this.inviteToGroupConversation.invite(
      new InviteToGroupConversationMessage({
        conversationId,
        recipientIdentityId,
        session,
      }),
    );
  }

  public async list(session: Session): Promise<ConversationResource[]> {
    return await this.listConversations.list(
      new ListConversationsMessage(session),
    );
  }

  public async markReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.markConversationReadUntil.mark(
      new MarkConversationReadUntilMessage({
        conversationId,
        messageId,
        session,
      }),
    );
  }
}
