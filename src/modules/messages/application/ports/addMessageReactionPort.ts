import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface AddMessageReactionPort {
  addMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void>;
}
