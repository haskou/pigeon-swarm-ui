import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { LoadMessagesAroundPort } from '../ports/LoadMessagesAroundPort';

import { LoadMessagesAroundMessage } from './messages/LoadMessagesAroundMessage';

export class LoadMessagesAround {
  public constructor(private readonly messages: LoadMessagesAroundPort) {}

  public async loadAround(message: LoadMessagesAroundMessage): Promise<{
    messages: ChatMessage[];
    nextCursor?: null | string;
    previousCursor?: null | string;
  }> {
    return await this.messages.loadMessagesAround(
      message.getSession(),
      message.getConversationId(),
      message.getMessageId(),
    );
  }
}
