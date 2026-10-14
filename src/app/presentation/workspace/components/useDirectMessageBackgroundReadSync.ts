import { useEffect, useRef } from 'react';

import type { ConversationWithUnread } from '../../../../contexts/conversations/presentation/view-models/ConversationWithUnread';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { LatestInput } from './LatestInput';

import { ConversationType } from '../../../../contexts/conversations/domain/value-objects/ConversationType';
import { DirectMailboxEligibility } from '../../../../contexts/mailboxes/domain/DirectMailboxEligibility';
import { applicationContainer } from '../../../composition/applicationContainer';
import { subscribeRealtimeMailboxHints } from '../../realtime/useRealtimeEvents';

const TICK_MS = 5000;
const VISIT_INTERVAL_MS = 30_000;
const VISITS_PER_TICK = 2;

export type DirectMessageBackgroundReadSyncInput = {
  activeConversationId: string | null;
  conversations: ConversationWithUnread[];
  onConversationRead: (conversationId: string) => void;
  session: Session;
};

/**
 * The one-to-one conversations that are not open, have unread messages, and
 * were not visited within VISIT_INTERVAL_MS. The least recently visited come
 * first.
 */
function dueConversationIds(
  latest: LatestInput,
  lastVisit: Map<string, number>,
  now: number,
): string[] {
  return latest.conversations
    .filter((conversation) => {
      const lastVisitAt = lastVisit.get(conversation.id);

      return (
        DirectMailboxEligibility.isEligible(
          ConversationType.tryFromPrimitives(conversation.type),
        ) &&
        conversation.id !== latest.activeConversationId &&
        conversation.unreadCount > 0 &&
        (lastVisitAt === undefined || now - lastVisitAt >= VISIT_INTERVAL_MS)
      );
    })
    .sort(
      (left, right) =>
        (lastVisit.get(left.id) ?? 0) - (lastVisit.get(right.id) ?? 0),
    )
    .map((conversation) => conversation.id);
}

/**
 * Subscribes to the inbox hint of each one-to-one conversation not yet
 * subscribed. A conversation whose inbox is not open has no target yet and is
 * retried on the next tick. Groups have no realtime hint.
 */
function subscribeHints(
  session: Session,
  conversations: ConversationWithUnread[],
  subscriptions: Map<string, () => void>,
  onHint: (conversationId: string) => void,
): void {
  conversations.forEach((conversation) => {
    if (
      !DirectMailboxEligibility.isEligible(
        ConversationType.tryFromPrimitives(conversation.type),
      )
    )
      return;

    if (subscriptions.has(conversation.id)) return;

    const target = applicationContainer.directMessages.hintTarget(
      session,
      conversation.id,
    );

    if (!target) return;

    subscriptions.set(
      conversation.id,
      subscribeRealtimeMailboxHints(session, target, () =>
        onHint(conversation.id),
      ),
    );
  });
}

/**
 * Clears unread on the one-to-one conversations that are not open, so a read
 * made on another device shows here too. Each tick visits at most
 * VISITS_PER_TICK conversations, and a conversation is visited at most once
 * per VISIT_INTERVAL_MS. A visit reads only own-identity read receipts. It
 * never acknowledges or writes the shared cursor, and it builds no messages
 * (see DirectMessageMailbox.syncReads).
 */
export function useDirectMessageBackgroundReadSync({
  activeConversationId,
  conversations,
  onConversationRead,
  session,
}: DirectMessageBackgroundReadSyncInput): void {
  const latestRef = useRef<LatestInput>({
    activeConversationId,
    conversations,
    onConversationRead,
  });
  latestRef.current = {
    activeConversationId,
    conversations,
    onConversationRead,
  };
  const lastVisitRef = useRef(new Map<string, number>());

  useEffect(() => {
    const controller = new AbortController();
    const lastVisit = lastVisitRef.current;
    let timer: number | undefined;
    let running = false;
    let queued = false;
    const hintUnsubscribes = new Map<string, () => void>();

    const visit = async (conversationId: string): Promise<void> => {
      lastVisit.set(conversationId, Date.now());

      try {
        await applicationContainer.directMessages.syncReads(
          session,
          conversationId,
          controller.signal,
          (changes) => {
            for (const change of changes) {
              if (change.kind === 'read') {
                latestRef.current.onConversationRead(conversationId);

                return;
              }
            }
          },
        );
      } catch {
        if (!controller.signal.aborted) {
          // eslint-disable-next-line no-console
          console.debug('Background read sync failed; retried later.');
        }
      }
    };

    const pass = async (): Promise<void> => {
      running = true;
      subscribeHints(
        session,
        latestRef.current.conversations,
        hintUnsubscribes,
        (conversationId) => {
          lastVisit.delete(conversationId);

          if (running) {
            queued = true;

            return;
          }

          window.clearTimeout(timer);
          void pass();
        },
      );

      const due = dueConversationIds(
        latestRef.current,
        lastVisit,
        Date.now(),
      ).slice(0, VISITS_PER_TICK);

      for (const conversationId of due) {
        if (controller.signal.aborted) {
          return;
        }
        await visit(conversationId);
      }

      running = false;

      if (!controller.signal.aborted) {
        if (queued) {
          queued = false;
          void pass();
        } else {
          timer = window.setTimeout(() => void pass(), TICK_MS);
        }
      }
    };

    void pass();

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      hintUnsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [session]);
}
