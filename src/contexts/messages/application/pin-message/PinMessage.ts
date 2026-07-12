import type { PinMessagePort } from './PinMessagePort';

import { PinMessageMessage } from './messages/PinMessageMessage';

export class PinMessage {
  public constructor(private readonly pins: PinMessagePort) {}

  public async pin(message: PinMessageMessage): Promise<void> {
    await this.pins.pinMessage(
      message.getSession(),
      message.getConversationId(),
      message.getMessageId(),
    );
  }
}
