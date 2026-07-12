import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { CallResource } from '../../domain/callSession.types';

export interface StartConversationCallPort {
  startConversation(
    session: Session,
    conversationId: string,
  ): Promise<CallResource>;
}
