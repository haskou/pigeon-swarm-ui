import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  Community,
  ConversationResource,
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { ArchivedNotifications } from '../../infrastructure/storage/ArchivedNotifications';
import { SeenNotifications } from '../../infrastructure/storage/SeenNotifications';
import { mergeNotificationOverrides } from './mergeNotificationOverrides';

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
const seenNotifications = new SeenNotifications();

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
  markVisibleAsSeen: () => void;
  refresh: () => Promise<void>;
  unreadCount: number;
  visible: NotificationResource[];
} {
  const [notifications, setNotifications] = useState<NotificationResource[]>(
    [],
  );
  const [archivedNotificationIds, setArchivedNotificationIds] = useState<
    string[]
  >(() => archivedNotifications.get(session.identity.id));
  const [seenNotificationIds, setSeenNotificationIds] = useState<string[]>(
    () => seenNotifications.get(session.identity.id),
  );
  const [action, setAction] = useState<NotificationAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notificationOverridesRef = useRef(
    new Map<string, NotificationResource>(),
  );
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
  const unreadCount = visible.filter(
    (notification) =>
      notification.status === 'unread' &&
      !seenNotificationIds.includes(notification.id),
  ).length;

  const replaceNotification = useCallback(
    (nextNotification: NotificationResource) => {
      notificationOverridesRef.current.set(
        nextNotification.id,
        nextNotification,
      );
      setNotifications((current) =>
        mergeNotificationOverrides(
          current.map((notification) =>
            notification.id === nextNotification.id
              ? nextNotification
              : notification,
          ),
          notificationOverridesRef.current,
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
        mergeNotificationOverrides(
          await applicationContainer.notifications.list(currentSession),
          notificationOverridesRef.current,
        ),
      );
      setArchivedNotificationIds(
        archivedNotifications.get(currentSession.identity.id),
      );
      setSeenNotificationIds(seenNotifications.get(currentSession.identity.id));
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.notifications.error));
    }
    setAction(null);
  }, []);

  useEffect(() => {
    setArchivedNotificationIds(archivedNotifications.get(session.identity.id));
    setSeenNotificationIds(seenNotifications.get(session.identity.id));
    void refresh();
  }, [refresh, session.identity.id]);

  const markVisibleAsSeen = useCallback(() => {
    const currentSession = sessionRef.current;
    const unreadIds = visible
      .filter((notification) => notification.status === 'unread')
      .map((notification) => notification.id);

    if (unreadIds.length === 0) return;

    setSeenNotificationIds(
      seenNotifications.markSeen(currentSession.identity.id, unreadIds),
    );
  }, [visible]);

  const accept = useCallback(
    async (notification: NotificationResource) => {
      const currentSession = sessionRef.current;

      setAction('accept');
      setError(null);

      try {
        const result = await applicationContainer.notifications.acceptConversationInvitation(
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
            : await applicationContainer.conversations.list(nextSession);
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
        setSeenNotificationIds(
          seenNotifications.markSeen(currentSession.identity.id, [
            notification.id,
          ]),
        );
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
          await applicationContainer.notifications.update(
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
    markVisibleAsSeen,
    refresh,
    unreadCount,
    visible,
  };
}

async function listCommunitiesAfterCommunityAccept(
  session: Session,
  communityId?: string,
): Promise<Community[]> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const communities = await applicationContainer.communities.list(session);

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

  return await applicationContainer.communities.list(session);
}
