import { Timestamp } from '@haskou/value-objects';

import type { DirectMessageRepository } from '../../domain/repositories/DirectMessageRepository';

import { MessageReactionChange } from '../../domain/MessageReactionChange';
import { MessageReactionAction } from '../../domain/value-objects/MessageReactionAction';
import { RemoveMessageReactionMessage } from './messages/RemoveMessageReactionMessage';

/** Removes a reaction on a one-to-one message, kept in the direct mailboxes. */
export class MessageReactionRemover {
  public constructor(
    private readonly directMessageRepository: DirectMessageRepository,
  ) {}

  public async remove(message: RemoveMessageReactionMessage): Promise<void> {
    await this.directMessageRepository.react(
      message.getConversationId(),
      MessageReactionChange.create(
        MessageReactionAction.remove(),
        message.getEmoji(),
        message.getMessageId(),
        Timestamp.now(),
      ),
      message.getAuthorId(),
    );
  }
}
