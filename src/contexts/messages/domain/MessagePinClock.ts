import type { MessagePinChange } from './MessagePinChange';
import type { MessageId } from './value-objects/MessageId';

/**
 * Last-writer-wins clock for message pins. Pin changes arrive out of order and
 * can be replayed, so a change is admitted only when it is newer than the last
 * change admitted for its message. The clock advances as it goes, so a later
 * change in the same pass still wins. The admitted changes then pin and unpin
 * in order.
 */
export class MessagePinClock {
  private readonly latest: MessagePinChange[] = [];

  public static applyTo(
    pinned: readonly MessageId[],
    changes: readonly MessagePinChange[],
  ): MessageId[] {
    return changes.reduce<MessageId[]>(
      (current, change) => {
        const messageId = change.getMessageId();
        const isPinned = current.some((candidate) =>
          candidate.isEqual(messageId),
        );

        if (!change.getAction().isPin()) {
          return current.filter((candidate) => !candidate.isEqual(messageId));
        }

        return isPinned ? current : [...current, messageId];
      },
      [...pinned],
    );
  }

  private isFresh(change: MessagePinChange): boolean {
    const latest = this.latest.find((candidate) =>
      candidate.getMessageId().isEqual(change.getMessageId()),
    );

    return !latest || change.getCreatedAt().isAfter(latest.getCreatedAt());
  }

  private advance(change: MessagePinChange): void {
    const index = this.latest.findIndex((candidate) =>
      candidate.getMessageId().isEqual(change.getMessageId()),
    );

    if (index === -1) {
      this.latest.push(change);
    } else {
      this.latest[index] = change;
    }
  }

  /** Returns the winning changes in order and advances the clock past them. */
  public admit(changes: readonly MessagePinChange[]): MessagePinChange[] {
    return changes.filter((change) => {
      if (!this.isFresh(change)) return false;

      this.advance(change);

      return true;
    });
  }
}
