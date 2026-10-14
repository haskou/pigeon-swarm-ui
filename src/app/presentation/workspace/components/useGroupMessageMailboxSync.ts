import { useEffect } from 'react';

import type { DirectMessageTimelineChange } from '../../../../contexts/messages/presentation/view-models/DirectMessageTimelineChange';
import type { GroupMessageMailboxSyncInput } from './GroupMessageMailboxSyncInput';

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
 * one settles. A cleanup aborts the running pass and the schedule. A failing
 * streak shows one notice unless another error is already shown; the next
 * successful pass clears only that notice. Pin records apply last-writer-wins
 * per message through one MessagePinClock per effect run. The first pass
 * that finds this identity off the roster refreshes the conversation list,
 * once per effect run, so the group leaves the sidebar.
 */
export function useGroupMessageMailboxSync({
  activeConversation,
  onErrorChange,
  onHistoryRestored,
  onMessagesChange,
  refreshConversations,
  session,
  setPinnedMessageIds,
}: GroupMessageMailboxSyncInput): void {
  const conversationId =
    activeConversation &&
    GroupMailboxEligibility.isEligible(activeConversation.type)
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
    const pass = async (): Promise<void> => {
      try {
        const { removed } = await applicationContainer.groupMessages.sync(
          session,
          conversationId,
          controller.signal,
          apply,
        );

        report(false);

        if (removed && !removalSeen && !controller.signal.aborted) {
          removalSeen = true;
          void refreshConversations().catch(() => null);
        }
      } catch {
        if (!controller.signal.aborted) report(true);
      }

      if (controller.signal.aborted) return;
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
    refreshConversations,
    session,
    setPinnedMessageIds,
  ]);
}
