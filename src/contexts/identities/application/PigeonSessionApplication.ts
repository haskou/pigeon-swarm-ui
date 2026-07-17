import type {
  LoginResult,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { LoginIdentityProgressReporter } from './login-identity/LoginIdentityProgressReporter';
import type { SessionApplicationPort } from './session/SessionApplicationPort';

import { ConversationTimeline } from '../../conversations/presentation/view-models/ConversationTimeline';

export class PigeonSessionApplication {
  public constructor(private readonly gateway: SessionApplicationPort) {}

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
