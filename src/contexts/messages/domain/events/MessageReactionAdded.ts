import { Timestamp } from '@haskou/value-objects';

import type { MessageAuthorId } from '../value-objects/MessageAuthorId';
import type { MessageId } from '../value-objects/MessageId';
import type { MessageReactionEmoji } from '../value-objects/MessageReactionEmoji';

import { MessageEventType } from '../value-objects/MessageEventType';
import { MessageDomainEvent } from './MessageDomainEvent';

export class MessageReactionAdded extends MessageDomainEvent {
  public constructor(
    messageId: MessageId,
    private readonly authorId: MessageAuthorId,
    private readonly emoji: MessageReactionEmoji,
    occurredAt: Timestamp,
  ) {
    super(messageId, occurredAt, MessageEventType.REACTION_ADDED);
  }

  public emojiUsed(): MessageReactionEmoji {
    return this.emoji;
  }

  public reactedBy(): MessageAuthorId {
    return this.authorId;
  }
}
