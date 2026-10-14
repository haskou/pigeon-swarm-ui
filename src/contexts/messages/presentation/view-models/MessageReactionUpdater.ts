import { Timestamp } from '@haskou/value-objects';

import type { ChatMessage } from '../../domain/ChatMessage';
import type { MessageReactionClock } from '../../domain/MessageReactionClock';

import { MessageAuthorId } from '../../domain/value-objects/MessageAuthorId';
import { MessageReactionAction } from '../../domain/value-objects/MessageReactionAction';
import { MessageReactionEmoji } from '../../domain/value-objects/MessageReactionEmoji';
import { MessageReadModelMapper } from './MessageReadModelMapper';

export class MessageReactionUpdater {
  /**
   * Applies a reaction write in arrival order (local toggles and legacy
   * realtime events) and advances the reaction's clock to the write's time.
   */
  public static update(
    message: ChatMessage,
    authorIdentityId: string,
    emoji: string,
    action: 'add' | 'remove',
    createdAt = Date.now(),
  ): ChatMessage {
    const aggregate = MessageReadModelMapper.toAggregate(message);
    const authorId = MessageAuthorId.fromString(authorIdentityId);
    const reactionEmoji = MessageReactionEmoji.fromString(emoji);
    const reactionAction = MessageReactionAction.fromPrimitives(action);

    if (reactionAction.isAdd()) {
      aggregate.addReaction(authorId, reactionEmoji, new Timestamp(createdAt));
    }

    if (reactionAction.isRemove()) {
      aggregate.removeReaction(
        authorId,
        reactionEmoji,
        new Timestamp(createdAt),
      );
    }

    return {
      ...MessageReadModelMapper.withAggregate(message, aggregate),
      reactionClocks: this.mergeClocks(message.reactionClocks, [
        {
          authorIdentityId: authorId.toString(),
          emoji: reactionEmoji.toString(),
          updatedAt: createdAt,
        },
      ]),
    };
  }

  /**
   * Applies a mailbox reaction write only when it is newer than the latest
   * write seen for the same message, author and emoji. Mailbox records can be
   * replayed or land out of envelope order, so an older add must not reopen a
   * reaction that a newer remove already cleared.
   */
  public static updateIfNewer(
    message: ChatMessage,
    authorIdentityId: string,
    emoji: string,
    action: 'add' | 'remove',
    createdAt: number,
  ): ChatMessage {
    const latestWriteAt = this.latestWriteAt(message, authorIdentityId, emoji);

    if (latestWriteAt !== undefined && createdAt <= latestWriteAt) {
      return message;
    }

    return this.update(message, authorIdentityId, emoji, action, createdAt);
  }

  /**
   * Merges reaction clocks per author and emoji, keeping the newest write for
   * each key. Used when a message is replaced so a removed reaction keeps its
   * clock.
   */
  public static mergeClocks(
    ...sources: Array<readonly MessageReactionClock[] | undefined>
  ): MessageReactionClock[] {
    const newest = new Map<string, MessageReactionClock>();

    for (const clock of sources.flatMap((source) => source ?? [])) {
      const key = `${clock.authorIdentityId}\u0000${clock.emoji}`;
      const previous = newest.get(key);

      if (!previous || clock.updatedAt > previous.updatedAt) {
        newest.set(key, clock);
      }
    }

    return [...newest.values()];
  }

  private static latestWriteAt(
    message: ChatMessage,
    authorIdentityId: string,
    emoji: string,
  ): number | undefined {
    const authorId = MessageAuthorId.fromString(authorIdentityId).toString();
    const reactionEmoji = MessageReactionEmoji.fromString(emoji).toString();
    const clockAt = message.reactionClocks?.find(
      (clock) =>
        clock.authorIdentityId === authorId && clock.emoji === reactionEmoji,
    )?.updatedAt;
    const reactionAt = message.reactions.find(
      (reaction) =>
        reaction.authorIdentityId === authorId &&
        reaction.emoji === reactionEmoji,
    )?.createdAt;
    const writes = [clockAt, reactionAt].filter(
      (at): at is number => at !== undefined,
    );

    return writes.length === 0 ? undefined : Math.max(...writes);
  }
}
