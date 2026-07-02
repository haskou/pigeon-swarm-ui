import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  Community,
  ConversationResource,
  IdentityPresence,
  SelectablePresenceStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../composition/applicationContainer';
import { ConversationPeer } from '../../../../contexts/conversations/domain/ConversationPeer';
import {
  readPresencePreference,
  writePresencePreference,
} from '../presencePreferenceStorage';
import { presenceStatusForLocalActivity } from './presenceStatusForLocalActivity';

const localActivityPresenceRefreshThrottleMs = 30_000;

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
  const lastLocalActivityPresenceRefreshAtRef = useRef(0);
  const localActivityPresenceRefreshInFlightRef = useRef(false);
  const presenceByIdentityIdRef = useRef<Record<string, IdentityPresence>>({});
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    presenceByIdentityIdRef.current = presenceByIdentityId;
  }, [presenceByIdentityId]);

  useEffect(() => {
    const preference = readPresencePreference(session.identity.id);

    presencePreferenceRef.current = preference;
    applicationContainer.setRealtimeHeartbeatActivityMode(
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
            ConversationPeer.identityId(
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
      applicationContainer.setRealtimeHeartbeatActivityMode(
        sessionRef.current,
        status === 'available' ? 'auto' : 'inactive',
      );
    },
    [],
  );
  const refreshLocalActivityPresence = useCallback((options?: {
    force?: boolean;
  }) => {
    const now = Date.now();

    if (
      localActivityPresenceRefreshInFlightRef.current ||
      now - lastLocalActivityPresenceRefreshAtRef.current <
        localActivityPresenceRefreshThrottleMs
    ) {
      return;
    }

    const nextStatus = presenceStatusForLocalActivity({
      force: options?.force,
      ownPresence:
        presenceByIdentityIdRef.current[sessionRef.current.identity.id],
      preferredStatus: presencePreferenceRef.current,
    });

    if (!nextStatus) return;

    lastLocalActivityPresenceRefreshAtRef.current = now;
    localActivityPresenceRefreshInFlightRef.current = true;
    void applicationContainer
      .updatePresence(sessionRef.current, { status: nextStatus })
      .then(mergePresence)
      .catch(() => undefined)
      .finally(() => {
        localActivityPresenceRefreshInFlightRef.current = false;
      });
  }, [mergePresence]);

  useEffect(() => {
    const onLocalActivity = () => refreshLocalActivityPresence();
    const onFocusedActivity = () =>
      refreshLocalActivityPresence({ force: true });
    const onVisible = () => {
      if (globalThis.document?.visibilityState === 'visible') {
        refreshLocalActivityPresence({ force: true });
      }
    };
    const movementEvent =
      'PointerEvent' in globalThis ? 'pointermove' : 'mousemove';
    const activityEvents = [
      'keydown',
      'mousedown',
      'pointerdown',
      'scroll',
      'touchstart',
      movementEvent,
    ];

    for (const eventName of activityEvents) {
      globalThis.addEventListener?.(eventName, onLocalActivity, {
        passive: true,
      });
    }
    globalThis.document?.addEventListener?.('visibilitychange', onVisible, {
      passive: true,
    });
    globalThis.addEventListener?.('focus', onFocusedActivity, {
      passive: true,
    });
    globalThis.addEventListener?.('pageshow', onFocusedActivity, {
      passive: true,
    });

    return () => {
      for (const eventName of activityEvents) {
        globalThis.removeEventListener?.(eventName, onLocalActivity);
      }
      globalThis.document?.removeEventListener?.(
        'visibilitychange',
        onVisible,
      );
      globalThis.removeEventListener?.('focus', onFocusedActivity);
      globalThis.removeEventListener?.('pageshow', onFocusedActivity);
    };
  }, [refreshLocalActivityPresence]);

  useEffect(() => {
    if (presenceIdentityIds.length === 0) return;

    let cancelled = false;

    void applicationContainer
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

          void applicationContainer
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

        void applicationContainer
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
