import { useCallback, useMemo, useState } from 'react';

import type {
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
    conversationId: string;
    conversations: ConversationResource[];
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
    setAction('refresh');
    setError(null);
    try {
      setNotifications(await pigeonApplication.listNotifications(session));
      setArchivedNotificationIds(
        archivedNotifications.get(session.identity.id),
      );
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.notifications.error));
    }
    setAction(null);
  }, [session]);

  const accept = useCallback(
    async (notification: NotificationResource) => {
      setAction('accept');
      setError(null);

      try {
        const result = await pigeonApplication.acceptConversationInvitation(
          session,
          notification,
        );
        const nextSession = {
          ...session,
          keychain: result.keychain,
          keychainExternalIdentifier: result.keychainExternalIdentifier,
        };
        const conversations =
          await pigeonApplication.listConversations(nextSession);

        replaceNotification(result.notification);
        onAccepted({
          conversationId: notification.payload.conversationId,
          conversations,
          session: nextSession,
        });
        onAcceptedPanelClose();
      } catch (caught) {
        setError(toUserErrorMessage(caught, copy.notifications.error));
      }
      setAction(null);
    },
    [onAccepted, onAcceptedPanelClose, replaceNotification, session],
  );

  const decline = useCallback(
    async (notificationId: string) => {
      setAction('decline');
      setError(null);

      try {
        replaceNotification(
          await pigeonApplication.updateNotification(
            session,
            notificationId,
            'declined',
          ),
        );
      } catch (caught) {
        setError(toUserErrorMessage(caught, copy.notifications.error));
      }
      setAction(null);
    },
    [replaceNotification, session],
  );

  const archive = useCallback(
    (notificationId: string) => {
      setArchivedNotificationIds(
        archivedNotifications.archive(session.identity.id, notificationId),
      );
    },
    [session.identity.id],
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
