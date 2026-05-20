import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { LoadMessagePort } from '../ports/loadMessagePort';

import { LoadMessageMessage } from './messages/loadMessageMessage';

export class LoadMessage {
  public constructor(private readonly messages: LoadMessagePort) {}

  public async load(message: LoadMessageMessage): Promise<ChatMessage | null> {
    return await this.messages.loadMessage(
      message.getSession(),
      message.getConversationId(),
      message.getMessageId(),
    );
  }
}
