import type { PrimitiveOf } from '@haskou/value-objects';

import { Timestamp } from '@haskou/value-objects';

import { MessageAuthorId } from '../value-objects/MessageAuthorId';
import { MessageReactionEmoji } from '../value-objects/MessageReactionEmoji';
import { MessageReactionEntry } from './MessageReactionEntry';

export class MessageReactions {
  public static empty(): MessageReactions {
    return new MessageReactions([]);
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<MessageReactions>,
  ): MessageReactions {
    return new MessageReactions(
      primitives.entries.map((entry) =>
        MessageReactionEntry.fromPrimitives(entry),
      ),
    );
  }

  private constructor(private entries: MessageReactionEntry[]) {}

  public add(
    authorId: MessageAuthorId,
    emoji: MessageReactionEmoji,
    occurredAt: Timestamp,
  ): boolean {
    if (this.has(authorId, emoji)) return false;

    this.entries = [
      ...this.entries,
      MessageReactionEntry.create(authorId, emoji, occurredAt),
    ];

    return true;
  }

  public count(): number {
    return this.entries.length;
  }

  public has(authorId: MessageAuthorId, emoji: MessageReactionEmoji): boolean {
    return this.entries.some((entry) => entry.belongsTo(authorId, emoji));
  }

  public remove(
    authorId: MessageAuthorId,
    emoji: MessageReactionEmoji,
  ): boolean {
    const remaining = this.entries.filter(
      (entry) => !entry.belongsTo(authorId, emoji),
    );

    if (remaining.length === this.entries.length) return false;

    this.entries = remaining;

    return true;
  }

  public toPrimitives() {
    return { entries: this.entries.map((entry) => entry.toPrimitives()) };
  }
}
