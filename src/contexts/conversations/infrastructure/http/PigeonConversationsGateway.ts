import type {
  ConversationResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ConversationTarget } from './ConversationTarget';
import type { GroupConversationInput } from './GroupConversationInput';

import { PigeonConversationCommandsApi } from './PigeonConversationCommandsApi';
import { PigeonConversationsApi } from './PigeonConversationsApi';

export class PigeonConversationsGateway {
  public constructor(
    private readonly conversations: PigeonConversationsApi,
    private readonly commands: PigeonConversationCommandsApi,
  ) {}

  public async createConversation(
    session: Session,
    peerIdentityId: string,
    networkId: string,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.commands.create(session, peerIdentityId, networkId);
  }

  public async createGroupConversation(
    session: Session,
    input: GroupConversationInput,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.commands.createGroup(session, input);
  }

  public async addGroupMember(
    session: Session,
    target: ConversationTarget,
    recipientIdentityId: string,
  ): Promise<ConversationResource> {
    return await this.commands.addMember(session, target, recipientIdentityId);
  }

  public async demoteGroupAdmin(
    session: Session,
    target: ConversationTarget,
    identityId: string,
  ): Promise<ConversationResource> {
    return await this.commands.demoteAdmin(session, target, identityId);
  }

  public async leaveGroupConversation(
    session: Session,
    target: ConversationTarget,
  ): Promise<ConversationResource> {
    return await this.commands.leave(session, target);
  }

  public async promoteGroupAdmin(
    session: Session,
    target: ConversationTarget,
    identityId: string,
  ): Promise<ConversationResource> {
    return await this.commands.promoteAdmin(session, target, identityId);
  }

  public async removeGroupMember(
    session: Session,
    target: ConversationTarget,
    identityId: string,
  ): Promise<ConversationResource> {
    return await this.commands.removeMember(session, target, identityId);
  }

  public async conversationFrontier(
    session: Session,
    conversationId: string,
  ): Promise<string[]> {
    return await this.commands.frontier(session, conversationId);
  }

  public async listConversations(
    session: Session,
  ): Promise<ConversationResource[]> {
    return await this.conversations.list(session);
  }

  public async markConversationReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.conversations.markReadUntil(session, conversationId, messageId);
  }
}
