import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  Community,
  ConversationResource,
  NotificationResource,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { ArchivedNotifications } from '../notifications/ArchivedNotifications';

type NotificationAction = 'accept' | 'archive' | 'decline' | 'refresh';

type UseNotificationsInput = {
  onAccepted: (next: {
    communities?: Community[];
    communityId?: string;
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
        const communityId =
          notification.type === 'community_invitation'
            ? notification.payload.communityId
            : undefined;
        const communities =
          notification.type === 'community_invitation'
            ? await listCommunitiesAfterCommunityAccept(
                nextSession,
                communityId,
              )
            : undefined;

        replaceNotification(result.notification);
        onAccepted({
          communities,
          communityId,
          conversationId:
            notification.type === 'conversation_invitation' ||
            notification.type === 'group_conversation_invitation'
              ? notification.payload.conversationId
              : undefined,
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

  const archive = useCallback((notificationId: string) => {
    const currentSession = sessionRef.current;

    setArchivedNotificationIds(
      archivedNotifications.archive(currentSession.identity.id, notificationId),
    );
  }, []);

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

async function listCommunitiesAfterCommunityAccept(
  session: Session,
  communityId?: string,
): Promise<Community[]> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const communities = await pigeonApplication.listCommunities(session);

    if (
      !communityId ||
      communities.some((community) => community.id === communityId)
    ) {
      return communities;
    }

    await new Promise((resolve) =>
      window.setTimeout(resolve, 200 * (attempt + 1)),
    );
  }

  return await pigeonApplication.listCommunities(session);
}
