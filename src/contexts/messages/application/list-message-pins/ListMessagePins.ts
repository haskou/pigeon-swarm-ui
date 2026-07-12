import type { MessagePin } from '../../../../shared/domain/pigeonResources.types';
import type { ListMessagePinsPort } from './ListMessagePinsPort';

import { ListMessagePinsMessage } from './messages/ListMessagePinsMessage';

export class ListMessagePins {
  public constructor(private readonly pins: ListMessagePinsPort) {}

  public async list(message: ListMessagePinsMessage): Promise<MessagePin[]> {
    return await this.pins.listMessagePins(
      message.getSession(),
      message.getConversationId(),
    );
  }
}
