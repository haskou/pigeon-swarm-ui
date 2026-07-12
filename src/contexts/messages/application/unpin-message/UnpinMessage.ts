import type { UnpinMessagePort } from './UnpinMessagePort';

import { UnpinMessageMessage } from './messages/UnpinMessageMessage';

export class UnpinMessage {
  public constructor(private readonly pins: UnpinMessagePort) {}

  public async unpin(message: UnpinMessageMessage): Promise<void> {
    await this.pins.unpinMessage(
      message.getSession(),
      message.getConversationId(),
      message.getMessageId(),
    );
  }
}
