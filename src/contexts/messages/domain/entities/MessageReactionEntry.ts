import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { MessageAuthorId } from '../value-objects/MessageAuthorId';
import { MessageReactionEmoji } from '../value-objects/MessageReactionEmoji';

export class MessageReactionEntry {
  public static create(
    authorId: MessageAuthorId,
    emoji: MessageReactionEmoji,
    createdAt: Timestamp,
  ): MessageReactionEntry {
    return new MessageReactionEntry(authorId, emoji, createdAt);
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<MessageReactionEntry>,
  ): MessageReactionEntry {
    return new MessageReactionEntry(
      MessageAuthorId.fromString(primitives.authorId),
      MessageReactionEmoji.fromString(primitives.emoji),
      new Timestamp(primitives.createdAt),
    );
  }

  private constructor(
    private readonly authorId: MessageAuthorId,
    private readonly emoji: MessageReactionEmoji,
    private readonly createdAt: Timestamp,
  ) {}

  public belongsTo(
    authorId: MessageAuthorId,
    emoji: MessageReactionEmoji,
  ): boolean {
    return this.authorId.isEqual(authorId) && this.emoji.isEqual(emoji);
  }

  public toPrimitives() {
    return {
      authorId: this.authorId.toString(),
      createdAt: this.createdAt.valueOf(),
      emoji: this.emoji.toString(),
    };
  }
}
