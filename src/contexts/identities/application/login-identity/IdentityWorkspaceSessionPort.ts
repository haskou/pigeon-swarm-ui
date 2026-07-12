import type {
  ConversationResource,
  KeychainResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface IdentityWorkspaceSessionPort {
  decryptKeychain(session: Session, keychain: KeychainResource): LocalKeychain;
  listConversations(session: Session): Promise<ConversationResource[]>;
  loadKeychain(session: Session): Promise<KeychainResource | undefined>;
}
