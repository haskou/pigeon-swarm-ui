import type {
  ConversationResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { CreateGroupConversationInput } from '../create-group-conversation/messages/createGroupConversationMessage';

export interface CreateGroupConversationPort {
  createGroupConversation(
    session: Session,
    input: CreateGroupConversationInput,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }>;
}
