import type { LoginIdentityProgressReporter } from '../../../contexts/identities/application/login-identity/LoginIdentityProgressReporter';
import type { PigeonIdentitiesGateway } from '../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type {
  ConversationResource,
  LoginResult,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { PigeonIdentitiesFacade } from './PigeonIdentitiesFacade';

import { ConversationTimeline } from '../../../contexts/conversations/presentation/view-models/ConversationTimeline';
import { ConversationKeychainRecovery } from '../../../contexts/identities/infrastructure/keychain/ConversationKeychainRecovery';

export class PigeonSessionFacade {
  public constructor(
    private readonly gateway: PigeonIdentitiesGateway,
    private readonly identities: PigeonIdentitiesFacade,
    private readonly keychainRecovery: ConversationKeychainRecovery,
  ) {}

  private sortConversations(result: LoginResult): LoginResult {
    return {
      ...result,
      conversations: ConversationTimeline.sortByLatestMessage(
        result.conversations,
      ),
    };
  }

  public recoverConversationKeys(
    session: Session,
    conversations: ConversationResource[],
  ): Session {
    return this.keychainRecovery.recover(session, conversations);
  }

  public async refresh(session: Session): Promise<LoginResult> {
    return this.sortConversations(await this.gateway.refreshSession(session));
  }

  public async restoreRemembered(
    identityId: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    return await this.identities.restoreRemembered(identityId, onProgress);
  }
}
