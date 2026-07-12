import type {
  ConversationResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
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

  public async inviteToGroupConversation(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    await this.commands.invite(
      session,
      conversationId,
      recipientIdentityId,
      'group_conversation_invitation',
    );
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
