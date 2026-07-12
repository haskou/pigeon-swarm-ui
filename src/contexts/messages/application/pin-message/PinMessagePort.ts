import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface PinMessagePort {
  pinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void>;
}
