import type { DirectMessageTimelineChange } from '../../../../contexts/messages/infrastructure/mailbox/DirectMessageTimelineChange';
import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { MessageReactionUpdater } from '../../../../contexts/messages/presentation/view-models/MessageReactionUpdater';
import { mergeConversationMessageIfTargetExists } from './conversationThreadState';

/**
 * Applies direct mailbox changes to the timeline in envelope order. Messages
 * dedupe by id, so a replayed pass changes nothing. An edit or reaction whose
 * target is not in the timeline is ignored. Reactions are last-writer-wins per
 * message, author and emoji, so a replayed or out-of-order add cannot undo a
 * newer remove.
 * Pin changes leave the timeline untouched; the sync hook applies them.
 */
export function applyDirectMessageTimelineChanges(
  current: ChatMessage[],
  changes: DirectMessageTimelineChange[],
): ChatMessage[] {
  return changes.reduce<ChatMessage[]>((messages, change) => {
    switch (change.kind) {
      case 'message':
        return MessageCollection.merge(messages, [change.message]);
      case 'edit':
        return mergeConversationMessageIfTargetExists(messages, change.message);
      case 'removed':
        return messages.filter((message) => message.id !== change.messageId);
      case 'reaction':
        return messages.map((message) =>
          message.id === change.messageId
            ? MessageReactionUpdater.updateIfNewer(
                message,
                change.authorId,
                change.emoji,
                change.action,
                change.createdAt,
              )
            : message,
        );
      case 'pin':
      case 'read':
        return messages;
    }
  }, current);
}
