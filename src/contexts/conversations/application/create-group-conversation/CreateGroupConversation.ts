import type {
  ConversationResource,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';
import type { CreateGroupConversationPort } from './CreateGroupConversationPort';

import { CreateGroupConversationMessage } from './messages/CreateGroupConversationMessage';

export type { CreateGroupConversationInput } from './messages/CreateGroupConversationMessage';

export class CreateGroupConversation {
  public constructor(
    private readonly conversations: CreateGroupConversationPort,
  ) {}

  public async create(message: CreateGroupConversationMessage): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.conversations.createGroupConversation(
      message.getSession(),
      message.getGroup(),
    );
  }
}
