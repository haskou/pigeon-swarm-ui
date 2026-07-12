import type {
  ConversationResource,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';
import type { CreateConversationPort } from './CreateConversationPort';

import { CreateConversationMessage } from './messages/CreateConversationMessage';

export class CreateConversation {
  public constructor(private readonly conversations: CreateConversationPort) {}

  public async create(message: CreateConversationMessage): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.conversations.createConversation(
      message.getSession(),
      message.getPeerIdentityId(),
      message.getNetworkId(),
    );
  }
}
