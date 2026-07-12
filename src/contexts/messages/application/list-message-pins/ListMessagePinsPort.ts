import type {
  MessagePin,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ListMessagePinsPort {
  listMessagePins(
    session: Session,
    conversationId: string,
  ): Promise<MessagePin[]>;
}
