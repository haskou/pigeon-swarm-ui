import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface RemoveMessageReactionPort {
  removeMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void>;
}
