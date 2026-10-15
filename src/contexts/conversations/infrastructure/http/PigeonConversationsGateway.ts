import type { LocalKeychain } from '../../../identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ConversationResource } from './ConversationResource';

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

  public async listConversations(
    session: Session,
  ): Promise<ConversationResource[]> {
    return await this.conversations.list(session);
  }
}
