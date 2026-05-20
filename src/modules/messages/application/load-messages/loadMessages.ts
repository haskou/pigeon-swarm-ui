import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { LoadMessagesPort } from '../ports/loadMessagesPort';

import { LoadMessagesMessage } from './messages/loadMessagesMessage';

export class LoadMessages {
  public constructor(private readonly messages: LoadMessagesPort) {}

  public async load(
    message: LoadMessagesMessage,
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    return await this.messages.loadMessages(
      message.getSession(),
      message.getConversationId(),
      message.getBefore(),
      message.getOptions(),
    );
  }
}
