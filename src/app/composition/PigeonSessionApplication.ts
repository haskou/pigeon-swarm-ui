import type { LoginIdentityProgressReporter } from '../../contexts/identities/application/ports/LoginIdentityProgressReporter';
import type {
  LoginResult,
  Session,
} from '../../shared/domain/pigeonResources.types';

import { ConversationTimeline } from '../../contexts/conversations/domain/ConversationTimeline';
import { PigeonApiGateway } from './PigeonApiGateway';

export class PigeonSessionApplication {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  private sortConversations(result: LoginResult): LoginResult {
    return {
      ...result,
      conversations: ConversationTimeline.sortByLatestMessage(
        result.conversations,
      ),
    };
  }

  public async refresh(session: Session): Promise<LoginResult> {
    return this.sortConversations(await this.gateway.refreshSession(session));
  }

  public async restoreRemembered(
    identityId: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    return this.sortConversations(
      await this.gateway.restoreRememberedSession(identityId, onProgress),
    );
  }
}
