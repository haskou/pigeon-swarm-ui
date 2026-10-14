import { Timestamp } from '@haskou/value-objects';

import type { DirectMessageRepository } from '../../domain/repositories/DirectMessageRepository';

import { MessagePinChange } from '../../domain/MessagePinChange';
import { MessagePinAction } from '../../domain/value-objects/MessagePinAction';
import { PinMessageMessage } from './messages/PinMessageMessage';

/** Pins a one-to-one message; its pins live in the direct mailboxes. */
export class MessagePinner {
  public constructor(
    private readonly directMessageRepository: DirectMessageRepository,
  ) {}

  public async pin(message: PinMessageMessage): Promise<void> {
    await this.directMessageRepository.pin(
      message.getConversationId(),
      MessagePinChange.create(
        MessagePinAction.pin(),
        message.getMessageId(),
        Timestamp.now(),
      ),
      message.getAuthorId(),
    );
  }
}
