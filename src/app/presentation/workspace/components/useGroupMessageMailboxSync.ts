import { useEffect } from 'react';

import type { DirectMessageTimelineChange } from '../../../../contexts/messages/domain/DirectMessageTimelineChange';
import type { GroupMessageMailboxSyncInput } from './GroupMessageMailboxSyncInput';

import { ConversationType } from '../../../../contexts/conversations/domain/value-objects/ConversationType';
import { GroupMailboxEligibility } from '../../../../contexts/mailboxes/domain/GroupMailboxEligibility';
import { MessagePinClock } from '../../../../contexts/messages/domain/MessagePinClock';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { applicationContainer } from '../../../composition/applicationContainer';
import { applyMailboxSyncChanges } from './applyMailboxSyncChanges';

/**
 * Builds and polls the timeline of the active group conversation from its
 * MLS group mailboxes alone. Each effect run first restores the stored
 * history, reports the restore to `onHistoryRestored`, then reads every
 * member inbox; the next pass is scheduled five seconds after the current
 * one settles. After the restore and each successful pass the stored
 * history is marked read on this device; after every pass this identity's
 * messages show their outbox state, as held while a removal is pending. A
 * marker that cannot be stored is retried by the next pass. A cleanup
 * aborts the running pass and the schedule. A failing streak shows one
 * notice unless another error is already shown; the next successful pass
 * clears only that notice. Pin records apply last-writer-wins per message
 * through one MessagePinClock per effect run. Restored and read poll
 * changes go to `onPollChanges`; typing changes, with the message changes
 * that end them, go to `onTypingChanges`. The first pass that finds
 * this identity off the roster refreshes the conversation list, once per
 * effect run, so the group leaves the sidebar.
 */
export function useGroupMessageMailboxSync({
  activeConversation,
  onErrorChange,
  onHistoryRestored,
  onMessagesChange,
  onPollChanges,
  onTypingChanges,
  refreshConversations,
  session,
  setPinnedMessageIds,
}: GroupMessageMailboxSyncInput): void {
  const conversationId =
    activeConversation &&
    GroupMailboxEligibility.isEligible(
      ConversationType.tryFromPrimitives(activeConversation.type),
    )
      ? activeConversation.id
      : undefined;

  useEffect(() => {
    if (!conversationId) return;

    const syncIntervalMs = 5000;
    const notice = copy.workspace.groupMailboxSyncError;
    const controller = new AbortController();
    const pinClock = new MessagePinClock();
    let failing = false;
    let removalSeen = false;
    let timer: number | undefined;
    const apply = (changes: DirectMessageTimelineChange[]): void => {
      const polls = changes.filter(({ kind }) => kind.startsWith('poll'));
      const typing = changes.filter(
        ({ kind }) => kind === 'typing' || kind === 'message',
      );

      if (polls.length > 0) onPollChanges(polls);

      if (typing.length > 0) onTypingChanges(conversationId, typing);
      applyMailboxSyncChanges(changes, pinClock, {
        onMessagesChange,
        setPinnedMessageIds,
      });
    };
    const report = (failed: boolean): void => {
      if (failed === failing) return;
      failing = failed;
      onErrorChange((current) => {
        if (failed) return current ?? notice;

        return current === notice ? null : current;
      });
    };
    const markRead = (): void => {
      void applicationContainer.groupMessages
        .markRead(session, conversationId)
        .catch(() => undefined);
    };
    const showOutboxState = (): void => {
      onMessagesChange((current) =>
        applicationContainer.groupMessages.withOutboxState(
          session,
          conversationId,
          current,
        ),
      );
    };
    const pass = async (): Promise<void> => {
      try {
        const { removed } = await applicationContainer.groupMessages.sync(
          session,
          conversationId,
          controller.signal,
          apply,
        );

        report(false);
        markRead();

        if (removed && !removalSeen && !controller.signal.aborted) {
          removalSeen = true;
          void refreshConversations().catch(() => null);
        }
      } catch {
        if (!controller.signal.aborted) report(true);
      }

      if (controller.signal.aborted) return;
      showOutboxState();
      timer = window.setTimeout(() => void pass(), syncIntervalMs);
    };
    const start = async (): Promise<void> => {
      await applicationContainer.groupMessages.restore(
        session,
        conversationId,
        controller.signal,
        apply,
      );

      if (controller.signal.aborted) return;
      onHistoryRestored(conversationId);
      markRead();
      showOutboxState();
      void pass();
    };

    void start();

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    conversationId,
    onErrorChange,
    onHistoryRestored,
    onMessagesChange,
    onPollChanges,
    onTypingChanges,
    refreshConversations,
    session,
    setPinnedMessageIds,
  ]);
}
