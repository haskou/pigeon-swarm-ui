import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  Community,
  ConversationResource,
  NotificationResource,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { ArchivedNotifications } from '../notifications/ArchivedNotifications';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';

type NotificationAction = 'accept' | 'archive' | 'decline' | 'refresh';

type UseNotificationsInput = {
  onAccepted: (next: {
    communities?: Community[];
    conversationId?: string;
    conversations?: ConversationResource[];
    session: Session;
  }) => void;
  onAcceptedPanelClose: () => void;
  session: Session;
};

const archivedNotifications = new ArchivedNotifications();

export function useNotifications({
  onAccepted,
  onAcceptedPanelClose,
  session,
}: UseNotificationsInput): {
  action: NotificationAction | null;
  archive: (notificationId: string) => void;
  error: string | null;
  accept: (notification: NotificationResource) => Promise<void>;
  decline: (notificationId: string) => Promise<void>;
  list: NotificationResource[];
  pendingCount: number;
  refresh: () => Promise<void>;
  visible: NotificationResource[];
} {
  const [notifications, setNotifications] = useState<NotificationResource[]>(
    [],
  );
  const [archivedNotificationIds, setArchivedNotificationIds] = useState<
    string[]
  >(() => archivedNotifications.get(session.identity.id));
  const [action, setAction] = useState<NotificationAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const visible = useMemo(
    () =>
      notifications.filter(
        (notification) => !archivedNotificationIds.includes(notification.id),
      ),
    [archivedNotificationIds, notifications],
  );
  const pendingCount = visible.filter(
    (notification) => notification.state === 'pending',
  ).length;

  const replaceNotification = useCallback(
    (nextNotification: NotificationResource) => {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === nextNotification.id
            ? nextNotification
            : notification,
        ),
      );
    },
    [],
  );

  const refresh = useCallback(async () => {
    const currentSession = sessionRef.current;

    setAction('refresh');
    setError(null);
    try {
      setNotifications(
        await pigeonApplication.listNotifications(currentSession),
      );
      setArchivedNotificationIds(
        archivedNotifications.get(currentSession.identity.id),
      );
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.notifications.error));
    }
    setAction(null);
  }, []);

  useEffect(() => {
    setArchivedNotificationIds(archivedNotifications.get(session.identity.id));
    void refresh();
  }, [refresh, session.identity.id]);

  const accept = useCallback(
    async (notification: NotificationResource) => {
      const currentSession = sessionRef.current;

      setAction('accept');
      setError(null);

      try {
        const result = await pigeonApplication.acceptConversationInvitation(
          currentSession,
          notification,
        );
        const nextSession = {
          ...currentSession,
          keychain: result.keychain,
          keychainExternalIdentifier: result.keychainExternalIdentifier,
        };
        const conversations =
          notification.type === 'community_invitation'
            ? undefined
            : await pigeonApplication.listConversations(nextSession);
        const communities =
          notification.type === 'community_invitation'
            ? await pigeonApplication.listCommunities(nextSession)
            : undefined;

        replaceNotification(result.notification);
        onAccepted({
          communities,
          conversationId:
            notification.type === 'community_invitation'
              ? undefined
              : notification.payload.conversationId,
          conversations,
          session: nextSession,
        });
        onAcceptedPanelClose();
      } catch (caught) {
        setError(toUserErrorMessage(caught, copy.notifications.error));
      }
      setAction(null);
    },
    [onAccepted, onAcceptedPanelClose, replaceNotification],
  );

  const decline = useCallback(
    async (notificationId: string) => {
      const currentSession = sessionRef.current;

      setAction('decline');
      setError(null);

      try {
        replaceNotification(
          await pigeonApplication.updateNotification(
            currentSession,
            notificationId,
            'declined',
          ),
        );
      } catch (caught) {
        setError(toUserErrorMessage(caught, copy.notifications.error));
      }
      setAction(null);
    },
    [replaceNotification],
  );

  const archive = useCallback(
    (notificationId: string) => {
      const currentSession = sessionRef.current;

      setArchivedNotificationIds(
        archivedNotifications.archive(
          currentSession.identity.id,
          notificationId,
        ),
      );
    },
    [],
  );

  return {
    accept,
    action,
    archive,
    decline,
    error,
    list: notifications,
    pendingCount,
    refresh,
    visible,
  };
}
