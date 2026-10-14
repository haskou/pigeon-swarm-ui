import { Timestamp } from '@haskou/value-objects';

import type { DirectMessageRepository } from '../../domain/repositories/DirectMessageRepository';

import { MessageReactionChange } from '../../domain/MessageReactionChange';
import { MessageReactionAction } from '../../domain/value-objects/MessageReactionAction';
import { AddMessageReactionMessage } from './messages/AddMessageReactionMessage';

/** Adds a reaction on a one-to-one message, kept in the direct mailboxes. */
export class MessageReactionAdder {
  public constructor(
    private readonly directMessageRepository: DirectMessageRepository,
  ) {}

  public async add(message: AddMessageReactionMessage): Promise<void> {
    await this.directMessageRepository.react(
      message.getConversationId(),
      MessageReactionChange.create(
        MessageReactionAction.add(),
        message.getEmoji(),
        message.getMessageId(),
        Timestamp.now(),
      ),
      message.getAuthorId(),
    );
  }
}
