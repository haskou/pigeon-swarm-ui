import { useCallback, useEffect, useRef, useState } from 'react';

import type { IdentityPresenceResource as IdentityPresence } from '../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { PresenceStatusResource } from '../../../../contexts/identities/infrastructure/http/resources/PresenceStatusResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { applicationContainer } from '../../../composition/applicationContainer';

const receiveEveryMs = 30_000;
const refreshEveryMs = 5000;
const publishEveryMs = 5000;

/**
 * Presence exchanged end to end with the contacts this device shares
 * presence with, one direct conversation at a time. Off until shared: no
 * contact sees this identity's status, nor does it see theirs, before then.
 */
export function useContactPresence({
  ownStatus,
  session,
}: {
  ownStatus?: PresenceStatusResource;
  session: Session;
}): {
  contactPresences: IdentityPresence[];
  presenceSharedConversationIds: ReadonlySet<string>;
  togglePresenceSharing: (
    conversationId: string,
    contactIdentityId: string,
  ) => void;
} {
  const [contactPresences, setContactPresences] = useState<IdentityPresence[]>(
    [],
  );
  const [sharedConversationIds, setSharedConversationIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const ownStatusRef = useRef(ownStatus);

  useEffect(() => {
    ownStatusRef.current = ownStatus;
  }, [ownStatus]);

  const loadSharings = useCallback(async () => {
    const sharings =
      await applicationContainer.identities.getPresenceSharings(session);

    setSharedConversationIds(
      new Set(sharings.map(({ conversationId }) => conversationId)),
    );
  }, [session]);
  const receive = useCallback(async () => {
    setContactPresences(
      await applicationContainer.identities.receiveContactPresences(session),
    );
  }, [session]);
  const publish = useCallback(async () => {
    if (!ownStatusRef.current) return;

    await applicationContainer.identities.publishContactPresence(
      session,
      ownStatusRef.current,
    );
  }, [session]);

  useEffect(() => {
    setContactPresences([]);
    void loadSharings().catch(() => undefined);
    void receive().catch(() => undefined);

    const receiving = globalThis.setInterval(() => {
      void receive().catch(() => undefined);
    }, receiveEveryMs);
    const refreshing = globalThis.setInterval(() => {
      void applicationContainer.identities
        .getContactPresences(session)
        .then(setContactPresences)
        .catch(() => undefined);
    }, refreshEveryMs);

    return () => {
      globalThis.clearInterval(receiving);
      globalThis.clearInterval(refreshing);
    };
  }, [loadSharings, receive, session]);

  useEffect(() => {
    void publish().catch(() => undefined);

    const publishing = globalThis.setInterval(() => {
      void publish().catch(() => undefined);
    }, publishEveryMs);

    return () => globalThis.clearInterval(publishing);
  }, [ownStatus, publish]);

  const togglePresenceSharing = useCallback(
    (conversationId: string, contactIdentityId: string) => {
      const identities = applicationContainer.identities;
      const change = sharedConversationIds.has(conversationId)
        ? identities.stopSharingContactPresence(
            session,
            conversationId,
            contactIdentityId,
          )
        : identities.shareContactPresence(
            session,
            conversationId,
            contactIdentityId,
          );

      void change
        .then(loadSharings)
        .then(() => Promise.all([publish(), receive()]))
        .catch(() => undefined);
    },
    [loadSharings, publish, receive, session, sharedConversationIds],
  );

  return {
    contactPresences,
    presenceSharedConversationIds: sharedConversationIds,
    togglePresenceSharing,
  };
}
