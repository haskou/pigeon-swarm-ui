import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface UnpinMessagePort {
  unpinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void>;
}
