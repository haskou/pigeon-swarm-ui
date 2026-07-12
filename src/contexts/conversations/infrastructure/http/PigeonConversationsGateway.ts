import type {
  ChatMessage,
  ConversationResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { PigeonMessagesApi } from '../../../messages/infrastructure/http/PigeonMessagesApi';
import type { CreateGroupConversationInput } from '../../application/create-group-conversation/messages/CreateGroupConversationInput';
import type { ConversationsGateway } from '../../application/ports/ConversationsGateway';
import type { PigeonConversationCommandsApi } from './PigeonConversationCommandsApi';
import type { PigeonConversationsApi } from './PigeonConversationsApi';

export class PigeonConversationsGateway implements ConversationsGateway {
  public constructor(
    private readonly commands: PigeonConversationCommandsApi,
    private readonly conversations: PigeonConversationsApi,
    private readonly messages: PigeonMessagesApi,
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
    input: CreateGroupConversationInput,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.commands.createGroup(session, input);
  }

  public async createGroupConversationInvitation(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    await this.commands.invite(session, conversationId, recipientIdentityId);
  }

  public async listConversations(
    session: Session,
  ): Promise<ConversationResource[]> {
    return await this.conversations.list(session);
  }

  public async loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    return await this.messages.loadMessages(
      session,
      conversationId,
      before,
      options ?? {},
    );
  }

  public async markConversationReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.conversations.markReadUntil(session, conversationId, messageId);
  }
}
