import { Timestamp } from '@haskou/value-objects';

import type { DirectMessageRepository } from '../../domain/repositories/DirectMessageRepository';

import { MessagePinChange } from '../../domain/MessagePinChange';
import { MessagePinAction } from '../../domain/value-objects/MessagePinAction';
import { UnpinMessageMessage } from './messages/UnpinMessageMessage';

/** Unpins a one-to-one message; its pins live in the direct mailboxes. */
export class MessageUnpinner {
  public constructor(
    private readonly directMessageRepository: DirectMessageRepository,
  ) {}

  public async unpin(message: UnpinMessageMessage): Promise<void> {
    await this.directMessageRepository.pin(
      message.getConversationId(),
      MessagePinChange.create(
        MessagePinAction.unpin(),
        message.getMessageId(),
        Timestamp.now(),
      ),
      message.getAuthorId(),
    );
  }
}
