import { useEffect, useRef } from 'react';

import type {
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../composition/applicationContainer';

const TICK_MS = 5000;
const VISIT_INTERVAL_MS = 30_000;
const VISITS_PER_TICK = 2;

type DirectMessageBackgroundReadSyncInput = {
  activeConversationId: string | null;
  conversations: ConversationResource[];
  onConversationRead: (conversationId: string) => void;
  session: Session;
};

type LatestInput = Omit<DirectMessageBackgroundReadSyncInput, 'session'>;

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
        conversation.type === 'one-to-one' &&
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

    const visit = async (conversationId: string): Promise<void> => {
      lastVisit.set(conversationId, Date.now());

      try {
        await applicationContainer.directMessages.syncReads(
          session,
          conversationId,
          controller.signal,
          (changes) => {
            if (changes.some((change) => change.kind === 'read')) {
              latestRef.current.onConversationRead(conversationId);
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

      if (!controller.signal.aborted) {
        timer = window.setTimeout(() => void pass(), TICK_MS);
      }
    };

    void pass();

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [session]);
}
