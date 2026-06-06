import type {
  ConversationResource,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';
import type { CreateGroupConversationPort } from '../ports/CreateGroupConversationPort';

import { CreateGroupConversationMessage } from './messages/createGroupConversationMessage';

export type { CreateGroupConversationInput } from './messages/createGroupConversationMessage';

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
