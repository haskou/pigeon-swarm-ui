import { useEffect, useRef } from 'react';

import type { GroupConversationActivity } from '../../../../contexts/groupMailboxes/infrastructure/GroupConversationActivity';
import type { GroupMessageBackgroundSyncInput } from './GroupMessageBackgroundSyncInput';

import { ConversationType } from '../../../../contexts/conversations/domain/value-objects/ConversationType';
import { GroupMailboxEligibility } from '../../../../contexts/mailboxes/domain/GroupMailboxEligibility';
import { applicationContainer } from '../../../composition/applicationContainer';

const TICK_MS = 5000;
const VISIT_INTERVAL_MS = 30_000;
const VISITS_PER_TICK = 2;

type LatestGroupInput = Omit<GroupMessageBackgroundSyncInput, 'session'>;

/** The groups on mailboxes that are not open, in the given order. */
function backgroundGroupIds(latest: LatestGroupInput): string[] {
  return latest.conversations
    .filter(
      (conversation) =>
        GroupMailboxEligibility.isEligible(
          ConversationType.tryFromPrimitives(conversation.type),
        ) && conversation.id !== latest.activeConversationId,
    )
    .map((conversation) => conversation.id);
}

/**
 * The background groups not visited within VISIT_INTERVAL_MS, the least
 * recently visited first.
 */
function dueGroupIds(
  latest: LatestGroupInput,
  lastVisit: Map<string, number>,
  now: number,
): string[] {
  return backgroundGroupIds(latest)
    .filter((conversationId) => {
      const lastVisitAt = lastVisit.get(conversationId);

      return (
        lastVisitAt === undefined || now - lastVisitAt >= VISIT_INTERVAL_MS
      );
    })
    .sort(
      (left, right) => (lastVisit.get(left) ?? 0) - (lastVisit.get(right) ?? 0),
    );
}

/**
 * Keeps the unread count and latest activity of the groups that are not
 * open. Each group is first reported once from its history on this device,
 * without network; then each tick reads the inboxes of at most
 * VISITS_PER_TICK groups into that history, a group at most once per
 * VISIT_INTERVAL_MS. A result for a group opened meanwhile is dropped: the
 * open conversation reads its own inboxes and marks them read. Each member
 * that announced an identity update during a visit goes to
 * `onIdentityUpdated`.
 */
export function useGroupMessageBackgroundSync({
  activeConversationId,
  conversations,
  onActivity,
  onIdentityUpdated,
  session,
}: GroupMessageBackgroundSyncInput): void {
  const latestRef = useRef<LatestGroupInput>({
    activeConversationId,
    conversations,
    onActivity,
    onIdentityUpdated,
  });
  latestRef.current = {
    activeConversationId,
    conversations,
    onActivity,
    onIdentityUpdated,
  };
  const lastVisitRef = useRef(new Map<string, number>());

  useEffect(() => {
    const controller = new AbortController();
    const lastVisit = lastVisitRef.current;
    const seeded = new Set<string>();
    let timer: number | undefined;

    const report = async (
      conversationId: string,
      read: () => Promise<GroupConversationActivity>,
    ): Promise<void> => {
      try {
        const activity = await read();

        if (
          !controller.signal.aborted &&
          latestRef.current.activeConversationId !== conversationId
        ) {
          latestRef.current.onActivity(conversationId, activity);
        }
      } catch {
        if (!controller.signal.aborted) {
          // eslint-disable-next-line no-console
          console.debug('Background group sync failed; retried later.');
        }
      }
    };

    const pass = async (): Promise<void> => {
      for (const conversationId of backgroundGroupIds(latestRef.current)) {
        if (controller.signal.aborted) return;

        if (seeded.has(conversationId)) continue;
        seeded.add(conversationId);
        await report(conversationId, () =>
          applicationContainer.groupMessages.activity(session, conversationId),
        );
      }
      const due = dueGroupIds(latestRef.current, lastVisit, Date.now()).slice(
        0,
        VISITS_PER_TICK,
      );

      for (const conversationId of due) {
        if (controller.signal.aborted) return;
        lastVisit.set(conversationId, Date.now());
        await report(conversationId, () =>
          applicationContainer.groupMessages.receive(
            session,
            conversationId,
            controller.signal,
            (identityId) => latestRef.current.onIdentityUpdated(identityId),
          ),
        );
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
