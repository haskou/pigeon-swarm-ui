import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { LoadMessageThreadPort } from './LoadMessageThreadPort';

import { LoadMessageThreadMessage } from './messages/LoadMessageThreadMessage';

export class LoadMessageThread {
  public constructor(private readonly threads: LoadMessageThreadPort) {}

  public async load(
    message: LoadMessageThreadMessage,
  ): Promise<{ messages: ChatMessage[]; nextBeforeMessageId?: null | string }> {
    return await this.threads.loadMessageThread(
      message.getSession(),
      message.getConversationId(),
      message.getMessageId(),
      message.getOptions(),
    );
  }
}
