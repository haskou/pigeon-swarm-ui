import type { Dispatch, SetStateAction } from 'react';

import { useEffect } from 'react';

import type { DirectMessageTimelineChange } from '../../../../contexts/messages/infrastructure/mailbox/DirectMessageTimelineChange';
import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { DirectMailboxEligibility } from '../../../../contexts/mailboxes/domain/DirectMailboxEligibility';
import { MailboxReaderLimitError } from '../../../../contexts/mailboxes/infrastructure/http/MailboxReaderLimitError';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { subscribeRealtimeMailboxHints } from '../../realtime/useRealtimeEvents';
import { applyDirectMessageTimelineChanges } from './applyDirectMessageTimelineChanges';

const SYNC_INTERVAL_MS = 5000;

type DirectMessageMailboxSyncInput = {
  activeConversation: ConversationResource | undefined;
  onConversationRead: (conversationId: string) => void;
  onErrorChange: Dispatch<SetStateAction<string | null>>;
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>;
  session: Session;
  setPinnedMessageIds: Dispatch<SetStateAction<Set<string>>>;
};

type DirectPinChange = Extract<DirectMessageTimelineChange, { kind: 'pin' }>;

/**
 * Keeps the pin changes newer than the last one applied to their message. The
 * clock advances as it goes, so a later change in the same pass still wins.
 */
function freshPinChanges(
  changes: DirectMessageTimelineChange[],
  clock: Map<string, number>,
): DirectPinChange[] {
  return changes.flatMap((change): DirectPinChange[] => {
    if (change.kind !== 'pin') return [];

    const latest = clock.get(change.messageId);

    if (latest !== undefined && change.createdAt <= latest) return [];

    clock.set(change.messageId, change.createdAt);

    return [change];
  });
}

function applyPinChanges(
  current: Set<string>,
  changes: DirectPinChange[],
): Set<string> {
  const next = new Set(current);

  for (const change of changes) {
    if (change.action === 'pin') {
      next.add(change.messageId);
    } else {
      next.delete(change.messageId);
    }
  }

  return next;
}

/**
 * Polls the recipient inbox of the active one-to-one conversation. Within one
 * effect run, the next pass is scheduled only after the current one settles.
 * A cleanup aborts the running pass, but that pass may still be in flight when
 * the next effect run starts (StrictMode mounts twice). `sync` checks the
 * signal at each step, and overlapping passes share one inbox creation. A
 * failing streak shows one notice unless another error is already shown. The
 * next successful pass clears only that notice.
 * Pin records apply last-writer-wins per message by createdAt. The clock
 * lasts one effect run; a replay after a conversation switch applies again.
 */
export function useDirectMessageMailboxSync({
  activeConversation,
  onConversationRead,
  onErrorChange,
  onMessagesChange,
  session,
  setPinnedMessageIds,
}: DirectMessageMailboxSyncInput): void {
  const conversationId =
    activeConversation &&
    DirectMailboxEligibility.isEligible(activeConversation.type)
      ? activeConversation.id
      : undefined;

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const controller = new AbortController();
    let notice: string | null = null;
    let timer: number | undefined;
    const pinClock = new Map<string, number>();
    let running = false;
    let queued = false;
    let unsubscribeHints: (() => void) | undefined;

    const pass = async (): Promise<void> => {
      running = true;
      try {
        await applicationContainer.directMessages.sync(
          session,
          conversationId,
          controller.signal,
          (changes) => {
            if (changes.length > 0) {
              onMessagesChange((current) =>
                applyDirectMessageTimelineChanges(current, changes),
              );
            }
            const pinChanges = freshPinChanges(changes, pinClock);
            if (pinChanges.length > 0) {
              setPinnedMessageIds((current) =>
                applyPinChanges(current, pinChanges),
              );
            }
            if (changes.some((change) => change.kind === 'read')) {
              onConversationRead(conversationId);
            }
          },
        );

        if (notice !== null) {
          const shown = notice;
          notice = null;
          onErrorChange((current) => (current === shown ? null : current));
        }

        if (!unsubscribeHints) {
          const target = applicationContainer.directMessages.hintTarget(
            session,
            conversationId,
          );

          if (target) {
            unsubscribeHints = subscribeRealtimeMailboxHints(
              session,
              target,
              () => {
                if (running) {
                  queued = true;

                  return;
                }

                window.clearTimeout(timer);
                void pass();
              },
            );
          }
        }
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        if (notice === null) {
          const message =
            caught instanceof MailboxReaderLimitError
              ? copy.workspace.directMailboxReaderLimitError
              : toUserErrorMessage(
                  caught,
                  copy.workspace.directMailboxSyncError,
                );
          notice = message;
          onErrorChange((current) => current ?? message);
        }
      }

      running = false;

      if (!controller.signal.aborted) {
        if (queued) {
          queued = false;
          void pass();
        } else {
          timer = window.setTimeout(() => void pass(), SYNC_INTERVAL_MS);
        }
      }
    };

    void pass();

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      unsubscribeHints?.();
    };
  }, [
    conversationId,
    onConversationRead,
    onErrorChange,
    onMessagesChange,
    session,
    setPinnedMessageIds,
  ]);
}
