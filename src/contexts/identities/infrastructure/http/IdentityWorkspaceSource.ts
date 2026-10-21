import type { ReplicatedStateReadOptions } from '../../../../shared/infrastructure/http/retryReplicatedStateRead';
import type { ConversationResource } from '../../../conversations/infrastructure/http/ConversationResource';
import type { LocalKeychain } from '../keychain/LocalKeychain';
import type { Session } from '../session/Session';
import type { KeychainResource } from './resources/KeychainResource';

export interface IdentityWorkspaceSource {
  decryptKeychain(session: Session, keychain: KeychainResource): LocalKeychain;
  listConversations(session: Session): Promise<ConversationResource[]>;
  loadKeychain(
    session: Session,
    options?: ReplicatedStateReadOptions,
  ): Promise<KeychainResource | undefined>;
}
