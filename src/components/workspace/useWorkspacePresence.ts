import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  Community,
  ConversationResource,
  IdentityPresence,
  SelectablePresenceStatus,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { conversationPeerIdentityId } from '../../domain/conversations/conversationPeer';
import {
  readPresencePreference,
  writePresencePreference,
} from '../../presentation/workspace/presencePreferenceStorage';

export function useWorkspacePresence({
  communities,
  conversations,
  messageAuthorIdentityIdsKey,
  session,
}: {
  communities: Community[];
  conversations: ConversationResource[];
  messageAuthorIdentityIdsKey: string;
  session: Session;
}) {
  const [presenceByIdentityId, setPresenceByIdentityId] = useState<
    Record<string, IdentityPresence>
  >({});
  const presencePreferenceRef = useRef<SelectablePresenceStatus | null>(
    readPresencePreference(session.identity.id),
  );
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const preference = readPresencePreference(session.identity.id);

    presencePreferenceRef.current = preference;
    pigeonApplication.setRealtimeHeartbeatActivityMode(
      session,
      !preference || preference === 'available' ? 'auto' : 'inactive',
    );
  }, [session]);

  const presenceIdentityIdsKey = useMemo(
    () =>
      Array.from(
        new Set([
          session.identity.id,
          ...conversations.flatMap((conversation) => [
            conversationPeerIdentityId(
              conversation,
              session.identity.id,
              session.keychain,
            ),
            ...(conversation.participantIdentityIds ??
              conversation.participantIds ??
              conversation.participants ??
              []),
          ]),
          ...communities.flatMap((community) => community.memberIds),
          ...messageAuthorIdentityIdsKey.split('\u0000'),
        ]),
      )
        .filter((identityId): identityId is string => !!identityId)
        .join('\u0000'),
    [communities, conversations, messageAuthorIdentityIdsKey, session],
  );
  const presenceIdentityIds = useMemo(
    () =>
      presenceIdentityIdsKey.length > 0
        ? presenceIdentityIdsKey.split('\u0000')
        : [],
    [presenceIdentityIdsKey],
  );
  const mergePresence = useCallback((presence: IdentityPresence) => {
    setPresenceByIdentityId((current) => ({
      ...current,
      [presence.identityId]: presence,
    }));
  }, []);
  const rememberPresencePreference = useCallback(
    (status: SelectablePresenceStatus) => {
      presencePreferenceRef.current = status;
      writePresencePreference(sessionRef.current.identity.id, status);
      pigeonApplication.setRealtimeHeartbeatActivityMode(
        sessionRef.current,
        status === 'available' ? 'auto' : 'inactive',
      );
    },
    [],
  );

  useEffect(() => {
    if (presenceIdentityIds.length === 0) return;

    let cancelled = false;

    void pigeonApplication
      .getPresences(session, presenceIdentityIds)
      .then((presences) => {
        if (cancelled) return;

        setPresenceByIdentityId((current) => ({
          ...current,
          ...Object.fromEntries(
            presences.map((presence) => [presence.identityId, presence]),
          ),
        }));

        const ownPresence = presences.find(
          (presence) => presence.identityId === session.identity.id,
        );
        const preferredStatus = presencePreferenceRef.current;

        if (preferredStatus && preferredStatus !== 'available') {
          if (ownPresence?.status === preferredStatus) return;

          void pigeonApplication
            .updatePresence(session, { status: preferredStatus })
            .then(mergePresence)
            .catch(() => undefined);

          return;
        }

        if (
          ownPresence &&
          ownPresence.status !== 'away' &&
          ownPresence.status !== 'disconnected'
        ) {
          return;
        }

        void pigeonApplication
          .updatePresence(session, { status: 'available' })
          .then(mergePresence)
          .catch(() => undefined);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [mergePresence, presenceIdentityIds, presenceIdentityIdsKey, session]);

  return {
    mergePresence,
    notificationsMutedByPresence:
      presenceByIdentityId[session.identity.id]?.status === 'busy',
    presenceByIdentityId,
    rememberPresencePreference,
  };
}
