import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { IdentityPresenceResource as IdentityPresence } from '../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { SelectablePresenceStatusResource as SelectablePresenceStatus } from '../../../../contexts/identities/infrastructure/http/resources/SelectablePresenceStatusResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { IdentityMatch } from '../../../../contexts/identities/domain/IdentityMatch';
import { applicationContainer } from '../../../composition/applicationContainer';
import {
  readPresencePreference,
  writePresencePreference,
} from '../presencePreferenceStorage';
import { presenceStatusForLocalActivity } from './presenceStatusForLocalActivity';
import { presenceWithLocalPreference } from './presenceWithLocalPreference';
import { useContactPresence } from './useContactPresence';

const localActivityPresenceRefreshThrottleMs = 30_000;

function reconcileOwnPresence(
  session: Session,
  ownPresence: IdentityPresence | undefined,
  preferredStatus: SelectablePresenceStatus | null,
  mergePresence: (presence: IdentityPresence) => void,
): void {
  const pinnedStatus =
    preferredStatus && preferredStatus !== 'available' ? preferredStatus : null;
  const needsUpdate = pinnedStatus
    ? ownPresence?.status !== pinnedStatus
    : !ownPresence ||
      ownPresence.status === 'away' ||
      ownPresence.status === 'disconnected';

  if (!needsUpdate) return;

  void applicationContainer.identities
    .updatePresence(session, pinnedStatus ?? 'available')
    .then(mergePresence)
    .catch(() => undefined);
}

/**
 * The workspace presence map. This identity's own presence comes from its
 * node; every contact's presence comes only from the end-to-end encrypted
 * presence inboxes, so node-side presence of others is never shown.
 */
export function useWorkspacePresence({ session }: { session: Session }): {
  mergePresence: (presence: IdentityPresence) => void;
  notificationsMutedByPresence: boolean;
  presenceByIdentityId: Record<string, IdentityPresence>;
  presenceSharedConversationIds: ReadonlySet<string>;
  rememberPresencePreference: (status: SelectablePresenceStatus) => void;
  togglePresenceSharing: (
    conversationId: string,
    contactIdentityId: string,
  ) => void;
} {
  const [ownPresence, setOwnPresence] = useState<IdentityPresence>();
  const presencePreferenceRef = useRef<SelectablePresenceStatus | null>(
    readPresencePreference(session.identity.id),
  );
  const lastLocalActivityPresenceRefreshAtRef = useRef(0);
  const localActivityPresenceRefreshInFlightRef = useRef(false);
  const ownPresenceRef = useRef<IdentityPresence | undefined>(undefined);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    ownPresenceRef.current = ownPresence;
  }, [ownPresence]);

  useEffect(() => {
    const preference = readPresencePreference(session.identity.id);

    presencePreferenceRef.current = preference;
    applicationContainer.realtime.setHeartbeatActivityMode(
      session,
      !preference || preference === 'available' ? 'auto' : 'inactive',
    );
  }, [session]);

  const mergePresence = useCallback((presence: IdentityPresence) => {
    const identityId = sessionRef.current.identity.id;

    if (!IdentityMatch.isSame(presence.identityId, identityId)) return;

    setOwnPresence(
      presenceWithLocalPreference(
        presence,
        identityId,
        presencePreferenceRef.current,
      ),
    );
  }, []);
  const rememberPresencePreference = useCallback(
    (status: SelectablePresenceStatus) => {
      presencePreferenceRef.current = status;
      writePresencePreference(sessionRef.current.identity.id, status);
      applicationContainer.realtime.setHeartbeatActivityMode(
        sessionRef.current,
        status === 'available' ? 'auto' : 'inactive',
      );
    },
    [],
  );
  const refreshLocalActivityPresence = useCallback(
    (options?: { force?: boolean }) => {
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
        ownPresence: ownPresenceRef.current,
        preferredStatus: presencePreferenceRef.current,
      });

      if (!nextStatus) return;

      lastLocalActivityPresenceRefreshAtRef.current = now;
      localActivityPresenceRefreshInFlightRef.current = true;
      void applicationContainer.identities
        .updatePresence(sessionRef.current, nextStatus)
        .then(mergePresence)
        .catch(() => undefined)
        .finally(() => {
          localActivityPresenceRefreshInFlightRef.current = false;
        });
    },
    [mergePresence],
  );

  useEffect(() => {
    const onLocalActivity = () => refreshLocalActivityPresence({ force: true });
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
    globalThis.addEventListener?.('focus', onLocalActivity, {
      passive: true,
    });
    globalThis.addEventListener?.('pageshow', onLocalActivity, {
      passive: true,
    });

    return () => {
      for (const eventName of activityEvents) {
        globalThis.removeEventListener?.(eventName, onLocalActivity);
      }
      globalThis.document?.removeEventListener?.('visibilitychange', onVisible);
      globalThis.removeEventListener?.('focus', onLocalActivity);
      globalThis.removeEventListener?.('pageshow', onLocalActivity);
    };
  }, [refreshLocalActivityPresence]);

  useEffect(() => {
    let cancelled = false;

    setOwnPresence(undefined);
    void applicationContainer.identities
      .getPresence(session, session.identity.id)
      .then((presence) => {
        if (cancelled) return;

        mergePresence(presence);
        reconcileOwnPresence(
          session,
          presence,
          presencePreferenceRef.current,
          mergePresence,
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [mergePresence, session]);

  const {
    contactPresences,
    presenceSharedConversationIds,
    togglePresenceSharing,
  } = useContactPresence({ ownStatus: ownPresence?.status, session });
  const presenceByIdentityId = useMemo(
    () => ({
      ...Object.fromEntries(
        contactPresences.map((presence): [string, IdentityPresence] => [
          presence.identityId,
          presence,
        ]),
      ),
      ...(ownPresence ? { [session.identity.id]: ownPresence } : {}),
    }),
    [contactPresences, ownPresence, session.identity.id],
  );

  return {
    mergePresence,
    notificationsMutedByPresence: ownPresence?.status === 'busy',
    presenceByIdentityId,
    presenceSharedConversationIds,
    rememberPresencePreference,
    togglePresenceSharing,
  };
}
