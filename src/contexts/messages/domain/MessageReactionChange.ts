import { Timestamp } from '@haskou/value-objects';

import { MessageId } from './value-objects/MessageId';
import { MessageReactionAction } from './value-objects/MessageReactionAction';
import { MessageReactionEmoji } from './value-objects/MessageReactionEmoji';

/** One add or remove of a reaction, stamped with when its author made it. */
export class MessageReactionChange {
  public static create(
    action: MessageReactionAction,
    emoji: MessageReactionEmoji,
    messageId: MessageId,
    createdAt: Timestamp,
  ): MessageReactionChange {
    return new MessageReactionChange(action, createdAt, emoji, messageId);
  }

  private constructor(
    private readonly action: MessageReactionAction,
    private readonly createdAt: Timestamp,
    private readonly emoji: MessageReactionEmoji,
    private readonly messageId: MessageId,
  ) {}

  public getAction(): MessageReactionAction {
    return this.action;
  }

  public getCreatedAt(): Timestamp {
    return this.createdAt;
  }

  public getEmoji(): MessageReactionEmoji {
    return this.emoji;
  }

  public getMessageId(): MessageId {
    return this.messageId;
  }
}
