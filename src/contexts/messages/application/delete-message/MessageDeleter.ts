import type { DirectMessageRepository } from '../../domain/repositories/DirectMessageRepository';

import { DeleteMessageMessage } from './messages/DeleteMessageMessage';

/** Deletes a one-to-one message, which lives in the direct mailboxes. */
export class MessageDeleter {
  public constructor(
    private readonly directMessageRepository: DirectMessageRepository,
  ) {}

  public async delete(message: DeleteMessageMessage): Promise<void> {
    await this.directMessageRepository.delete(
      message.getConversationId(),
      message.getMessageId(),
      message.getAuthorId(),
    );
  }
}
