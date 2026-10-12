import type { PigeonIdentitiesGateway } from '../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { LoginResult } from '../../../contexts/identities/infrastructure/http/resources/LoginResult';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { PigeonIdentitiesFacade } from './PigeonIdentitiesFacade';

import { ConversationTimeline } from '../../../contexts/conversations/presentation/view-models/ConversationTimeline';

export class PigeonSessionFacade {
  public constructor(
    private readonly gateway: PigeonIdentitiesGateway,
    private readonly identities: PigeonIdentitiesFacade,
  ) {}

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
}
