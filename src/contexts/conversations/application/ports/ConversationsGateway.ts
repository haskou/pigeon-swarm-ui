import type {
  ChatMessage,
  ConversationResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { CreateGroupConversationInput } from '../create-group-conversation/messages/CreateGroupConversationMessage';

export interface ConversationsGateway {
  createConversation(
    session: Session,
    peerIdentityId: string,
    networkId: string,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }>;

  createGroupConversation(
    session: Session,
    input: CreateGroupConversationInput,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }>;

  createGroupConversationInvitation(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void>;

  listConversations(session: Session): Promise<ConversationResource[]>;

  loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }>;

  markConversationReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void>;
}
