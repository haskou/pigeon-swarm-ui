import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { DecryptMessagePort } from './DecryptMessagePort';

import { DecryptMessageMessage } from './messages/DecryptMessageMessage';

export class DecryptMessage {
  public constructor(private readonly messages: DecryptMessagePort) {}

  public async decrypt(message: DecryptMessageMessage): Promise<ChatMessage> {
    return await this.messages.decryptMessage(
      message.getSession(),
      message.getConversationId(),
      message.getMessage(),
    );
  }
}
