import type {
  ConversationResource,
  LocalKeychain,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { ConversationsGateway } from './ports/ConversationsGateway';

import { CreateConversation } from './create-conversation/CreateConversation';
import { CreateConversationMessage } from './create-conversation/messages/CreateConversationMessage';
import {
  CreateGroupConversation,
  type CreateGroupConversationInput,
} from './create-group-conversation/CreateGroupConversation';
import { CreateGroupConversationMessage } from './create-group-conversation/messages/CreateGroupConversationMessage';
import { ListConversations } from './list-conversations/ListConversations';
import { ListConversationsMessage } from './list-conversations/messages/ListConversationsMessage';

export class PigeonConversationsApplication {
  private readonly createConversation: CreateConversation;

  private readonly createGroupConversation: CreateGroupConversation;

  private readonly listConversations: ListConversations;

  public constructor(private readonly gateway: ConversationsGateway) {
    this.createConversation = new CreateConversation(gateway);
    this.createGroupConversation = new CreateGroupConversation(gateway);
    this.listConversations = new ListConversations(gateway);
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
    await this.gateway.createGroupConversationInvitation(
      session,
      conversationId,
      recipientIdentityId,
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
    await this.gateway.markConversationReadUntil(
      session,
      conversationId,
      messageId,
    );
  }
}
