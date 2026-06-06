import type {
  ConversationResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface CreateConversationPort {
  createConversation(
    session: Session,
    peerIdentityId: string,
    networkId: string,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }>;
}
