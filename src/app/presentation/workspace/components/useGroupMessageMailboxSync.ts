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
 * that end them, go to `onTypingChanges`; each member that announced an
 * identity update goes to `onIdentityUpdated`. The first pass that finds
 * this identity off the roster refreshes the conversation list, once per
 * effect run, so the group leaves the sidebar. While a pass finds that
 * this device awaits the group's confirmation, a notice says the group is
 * not yet verified and its messages wait, unless another error is already
 * shown; a later pass that finds it confirmed, or the cleanup, clears only
 * that notice.
 */
export function useGroupMessageMailboxSync({
  activeConversation,
  onErrorChange,
  onHistoryRestored,
  onIdentityUpdated,
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
    const controller = new AbortController();
    const pinClock = new MessagePinClock();
    let removalSeen = false;
    let timer: number | undefined;
    const apply = (changes: DirectMessageTimelineChange[]): void => {
      const polls = changes.filter(({ kind }) => kind.startsWith('poll'));
      const typing = changes.filter(
        ({ kind }) => kind === 'typing' || kind === 'message',
      );

      if (polls.length > 0) onPollChanges(polls);

      if (typing.length > 0) onTypingChanges(conversationId, typing);

      for (const change of changes) {
        if (change.kind === 'identity_updated') {
          onIdentityUpdated(change.identityId);
        }
      }
      applyMailboxSyncChanges(changes, pinClock, {
        onMessagesChange,
        setPinnedMessageIds,
      });
    };
    /** Shows `notice` while `show` holds, unless another error is shown. */
    const noticeShower = (notice: string): ((show: boolean) => void) => {
      let shown = false;

      return (show) => {
        if (show === shown) return;
        shown = show;
        onErrorChange((current) => {
          if (show) return current ?? notice;

          return current === notice ? null : current;
        });
      };
    };
    const report = noticeShower(copy.workspace.groupMailboxSyncError);
    const showUnconfirmed = noticeShower(copy.workspace.groupUnconfirmed);
    const showOutgrown = noticeShower(copy.workspace.groupOutgrown);
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
        const { outgrown, removed, unconfirmed } =
          await applicationContainer.groupMessages.sync(
            session,
            conversationId,
            controller.signal,
            apply,
          );

        report(false);
        markRead();

        if (!controller.signal.aborted) {
          showUnconfirmed(unconfirmed);
          showOutgrown(outgrown);
        }

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
      showUnconfirmed(false);
      showOutgrown(false);
    };
  }, [
    conversationId,
    onErrorChange,
    onHistoryRestored,
    onIdentityUpdated,
    onMessagesChange,
    onPollChanges,
    onTypingChanges,
    refreshConversations,
    session,
    setPinnedMessageIds,
  ]);
}
