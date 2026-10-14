import type { Dispatch, SetStateAction } from 'react';

import { Timestamp } from '@haskou/value-objects';

import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { DirectMessageTimelineChange } from '../../../../contexts/messages/domain/DirectMessageTimelineChange';

import { MessagePinChange } from '../../../../contexts/messages/domain/MessagePinChange';
import { MessagePinClock } from '../../../../contexts/messages/domain/MessagePinClock';
import { MessageId } from '../../../../contexts/messages/domain/value-objects/MessageId';
import { applyDirectMessageTimelineChanges } from './applyDirectMessageTimelineChanges';

/**
 * Applies one mailbox sync batch to the open timeline and its pinned set.
 * Pin records apply last-writer-wins per message by createdAt through the
 * given clock, each clamped to the window around the time this batch is
 * applied.
 */
export function applyMailboxSyncChanges(
  changes: DirectMessageTimelineChange[],
  pinClock: MessagePinClock,
  handlers: {
    onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>;
    setPinnedMessageIds: Dispatch<SetStateAction<Set<string>>>;
  },
): void {
  if (changes.length > 0) {
    handlers.onMessagesChange((current) =>
      applyDirectMessageTimelineChanges(current, changes),
    );
  }

  // A peer can write a pin the domain cannot hold (an empty or over-long id):
  // skip it, so one bad record does not stall the sync of the whole page.
  const pinChanges = pinClock.admit(
    changes.flatMap((change) => {
      if (change.kind !== 'pin') return [];

      try {
        return [MessagePinChange.fromPrimitives(change)];
      } catch {
        return [];
      }
    }),
    Timestamp.now(),
  );

  if (pinChanges.length > 0) {
    handlers.setPinnedMessageIds(
      (current) =>
        new Set(
          MessagePinClock.applyTo(
            [...current].map((messageId) => MessageId.fromString(messageId)),
            pinChanges,
          ).map((messageId) => messageId.valueOf()),
        ),
    );
  }
}
