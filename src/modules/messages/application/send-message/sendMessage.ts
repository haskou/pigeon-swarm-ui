import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { SendMessagePort } from '../ports/sendMessagePort';

import { SendMessageMessage } from './messages/sendMessageMessage';

export class SendMessage {
  public constructor(private readonly messages: SendMessagePort) {}

  public async send(message: SendMessageMessage): Promise<ChatMessage> {
    return await this.messages.sendMessage(
      message.getSession(),
      message.getConversationId(),
      message.getContent(),
      message.getOptions(),
    );
  }
}
