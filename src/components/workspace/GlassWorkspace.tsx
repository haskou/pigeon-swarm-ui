import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ChatMessage,
  AttachmentProgress,
  ConversationResource,
  IdentityResource,
  NotificationResource,
  Session,
} from '../../domain/types';
import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';

import { pigeonApplication } from '../../application/applicationContainer';
import { conversationKeyEntry } from '../../domain/conversations/conversationKey';
import { conversationPeerIdentityId } from '../../domain/conversations/conversationPeer';
import { copy } from '../../i18n/en';
import { ArchivedNotifications } from '../../presentation/notifications/ArchivedNotifications';
import { cx } from '../../utils/classNameHelper';
import {
  identityName,
  identityPicture,
  profilePictureDataUrl,
  type IdentityNames,
  type IdentityPictures,
} from '../../utils/identityDisplay';
import { CreateConversationDialog } from '../dialog/CreateConversationDialog';
import { ChatColumn } from './ChatColumn';
import { Inspector } from './Inspector';
import { NodeSettingsDialog } from './NodeSettingsDialog';
import { NotificationsPanel } from './NotificationsPanel';
import { Rail } from './Rail';
import { Sidebar } from './Sidebar';

type LoadState = 'idle' | 'loading' | 'error';
type NotificationAction = 'accept' | 'archive' | 'decline' | 'refresh';

const archivedNotifications = new ArchivedNotifications();

async function loadIdentityPicture(
  identity: IdentityResource,
): Promise<string | null> {
  const directPicture = identityPicture(identity);

  if (directPicture) return directPicture;

  const pictureCid = identity.profile.picture?.trim();

  if (!pictureCid) return null;

  const content = await pigeonApplication.getPublicFile(pictureCid);

  return profilePictureDataUrl(content);
}

interface GlassWorkspaceProps {
  session: Session;
  setSession: (session: Session | null) => void;
  conversations: ConversationResource[];
  node: { id: string; owner: null | string } | null;
  nodeNetworks: NodeNetwork[];
  onNodeNetworksReload: () => Promise<void>;
  setConversations: (conversations: ConversationResource[]) => void;
}

export function GlassWorkspace({
  conversations,
  node,
  nodeNetworks,
  onNodeNetworksReload,
  session,
  setConversations,
  setSession,
}: GlassWorkspaceProps) {
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(conversations[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<LoadState>('idle');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentProgress, setAttachmentProgress] =
    useState<AttachmentProgress | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nodeSettingsOpen, setNodeSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationResource[]>(
    [],
  );
  const [archivedNotificationIds, setArchivedNotificationIds] = useState<
    string[]
  >(() => archivedNotifications.get(session.identity.id));
  const [notificationAction, setNotificationAction] =
    useState<NotificationAction | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(
    null,
  );
  const [identityNames, setIdentityNames] = useState<IdentityNames>(() => ({
    [session.identity.id]: identityName(session.identity) ?? session.identity.id,
  }));
  const [identityProfiles, setIdentityProfiles] = useState<
    Record<string, IdentityResource>
  >(() => ({ [session.identity.id]: session.identity }));
  const [identityPictures, setIdentityPictures] = useState<IdentityPictures>(
    () => ({
      ...(identityPicture(session.identity)
        ? { [session.identity.id]: identityPicture(session.identity) as string }
        : {}),
    }),
  );
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const messageRequestRef = useRef(0);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ) ?? conversations[0],
    [activeConversationId, conversations],
  );
  const visibleNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) => !archivedNotificationIds.includes(notification.id),
      ),
    [archivedNotificationIds, notifications],
  );
  const pendingNotificationCount = visibleNotifications.filter(
    (notification) => notification.state === 'pending',
  ).length;
  const nodeUnclaimed = !node?.owner;
  const activeConversationKey = activeConversation
    ? conversationKeyEntry(
        session.keychain,
        session.identity.id,
        activeConversation.id,
      )
    : undefined;
  const activeConversationKeyId = activeConversationKey?.conversationId ?? null;
  const identityIdsToResolve = useMemo(() => {
    const ids = new Set<string>();

    conversations.forEach((conversation) => {
      const peerIdentityId = conversationPeerIdentityId(
        conversation,
        session.identity.id,
        session.keychain,
      );

      if (peerIdentityId) ids.add(peerIdentityId);
      conversation.participantIdentityIds?.forEach((identityId) =>
        ids.add(identityId),
      );
      conversation.participantIds?.forEach((identityId) => ids.add(identityId));
    });
    notifications.forEach((notification) => {
      ids.add(notification.payload.inviterIdentityId);
      ids.add(notification.payload.recipientIdentityId);
    });
    messages.forEach((message) => ids.add(message.authorIdentityId));
    ids.delete(session.identity.id);

    return [...ids].filter((identityId) => !identityProfiles[identityId]);
  }, [
    conversations,
    identityProfiles,
    messages,
    notifications,
    session.identity.id,
  ]);

  useEffect(() => {
    if (!activeConversationId && conversations[0])
      setActiveConversationId(conversations[0].id);
  }, [activeConversationId, conversations]);

  useEffect(() => {
    let cancelled = false;

    void loadIdentityPicture(session.identity)
      .then((picture) => {
        if (cancelled) return;

        setIdentityPictures((current) => {
          const next = { ...current };

          if (picture) next[session.identity.id] = picture;
          else delete next[session.identity.id];

          return next;
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [session.identity]);

  useEffect(() => {
    if (identityIdsToResolve.length === 0) return;

    let cancelled = false;

    void Promise.all(
      identityIdsToResolve.map(async (identityId) => {
        try {
          const identity = await pigeonApplication.getIdentity(identityId);
          const picture = await loadIdentityPicture(identity).catch(
            () => null,
          );

          return [
            identityId,
            identityName(identity) ?? identityId,
            picture,
            identity,
          ] as const;
        } catch {
          return [identityId, identityId, null, null] as const;
        }
      }),
    ).then((resolvedIdentities) => {
      if (cancelled) return;

      setIdentityNames((current) => ({
        ...current,
        ...Object.fromEntries(
          resolvedIdentities.map(([identityId, name]) => [identityId, name]),
        ),
      }));
      setIdentityProfiles((current) => ({
        ...current,
        ...Object.fromEntries(
          resolvedIdentities
            .filter(([, , , identity]) => !!identity)
            .map(([identityId, , , identity]) => [
              identityId,
              identity as IdentityResource,
            ]),
        ),
      }));
      setIdentityPictures((current) => ({
        ...current,
        ...Object.fromEntries(
          resolvedIdentities
            .filter(([, , picture]) => !!picture)
            .map(([identityId, , picture]) => [identityId, picture as string]),
        ),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [identityIdsToResolve]);

  const refreshConversations = useCallback(async () => {
    const next = await pigeonApplication.listConversations(session);
    setConversations(next);
  }, [session, setConversations]);

  const refreshNotifications = useCallback(async () => {
    setNotificationAction('refresh');
    setNotificationError(null);
    try {
      setNotifications(await pigeonApplication.listNotifications(session));
    } catch (caught) {
      setNotificationError(
        caught instanceof Error ? caught.message : copy.notifications.error,
      );
    }
    setNotificationAction(null);
  }, [session]);

  useEffect(() => {
    setArchivedNotificationIds(archivedNotifications.get(session.identity.id));
    void refreshNotifications();
  }, [refreshNotifications, session.identity.id]);

  const loadActiveMessages = useCallback(
    async (conversationId: string) => {
      const requestId = messageRequestRef.current + 1;

      messageRequestRef.current = requestId;
      setMessageState('loading');
      setSendError(null);
      try {
        const result = await pigeonApplication.loadMessages(
          session,
          conversationId,
        );

        if (messageRequestRef.current !== requestId) return;

        setMessages(result.messages);
        setMessageCursor(result.nextCursor ?? null);
        queueMicrotask(() => {
          bottomRef.current?.scrollIntoView({ block: 'end' });
          lastScrollTopRef.current = scrollerRef.current?.scrollTop ?? 0;
        });
      } catch (caught) {
        if (messageRequestRef.current !== requestId) return;

        setMessages([]);
        setMessageState('error');
        setSendError(
          caught instanceof Error
            ? caught.message
            : copy.workspace.loadMessagesError,
        );

        return;
      }
      if (messageRequestRef.current !== requestId) return;

      setMessageState('idle');
    },
    [session],
  );

  useEffect(() => {
    if (!activeConversation?.id) return;

    if (!activeConversationKeyId) {
      setMessages([]);
      setMessageCursor(null);
      lastScrollTopRef.current = 0;
      setMessageState('idle');
      return;
    }

    void loadActiveMessages(activeConversation.id);
  }, [activeConversation?.id, activeConversationKeyId, loadActiveMessages]);

  const handleLoadOlder = async () => {
    if (
      !activeConversation?.id ||
      !activeConversationKey ||
      !messageCursor ||
      messageState === 'loading'
    )
      return;

    const requestId = messageRequestRef.current + 1;

    messageRequestRef.current = requestId;
    const previousHeight = scrollerRef.current?.scrollHeight ?? 0;
    const previousTop = scrollerRef.current?.scrollTop ?? 0;
    setMessageState('loading');
    try {
      const result = await pigeonApplication.loadMessages(
        session,
        activeConversation.id,
        messageCursor,
      );
      if (messageRequestRef.current !== requestId) return;

      setMessages((current) => [...result.messages, ...current]);
      setMessageCursor(result.nextCursor ?? null);
      requestAnimationFrame(() => {
        if (!scrollerRef.current) return;

        const nextTop =
          scrollerRef.current.scrollHeight - previousHeight + previousTop;

        scrollerRef.current.scrollTop = nextTop;
        lastScrollTopRef.current = nextTop;
      });
    } catch (caught) {
      setSendError(
        caught instanceof Error
          ? caught.message
          : copy.workspace.loadOlderError,
      );
    }
    if (messageRequestRef.current !== requestId) return;

    setMessageState('idle');
  };

  const handleScroll = () => {
    const scrollTop = scrollerRef.current?.scrollTop ?? 0;
    const isScrollingUp = scrollTop < lastScrollTopRef.current;

    lastScrollTopRef.current = scrollTop;

    if (isScrollingUp && scrollTop < 80) void handleLoadOlder();
  };

  const handleSend = async (content: string, attachments: File[]) => {
    if (!activeConversation?.id) return;
    setSendError(null);
    setAttachmentProgress(null);

    try {
      const lastMessageId = messages[messages.length - 1]?.id;
      const sent = await pigeonApplication.sendMessage(
        session,
        activeConversation.id,
        content,
        lastMessageId ? [lastMessageId] : [],
        attachments,
        setAttachmentProgress,
      );
      setMessages((current) => [...current, sent]);
      setAttachmentProgress(null);
      queueMicrotask(() =>
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }),
      );
      void refreshConversations().catch(() => undefined);
    } catch (caught) {
      setSendError(
        caught instanceof Error ? caught.message : copy.workspace.sendError,
      );
      setAttachmentProgress(null);
    }
  };

  const handleConversationCreated = (
    nextSession: Session,
    conversation: ConversationResource,
  ) => {
    setSession(nextSession);
    setConversations([
      conversation,
      ...conversations.filter((item) => item.id !== conversation.id),
    ]);
    setActiveConversationId(conversation.id);
    setIsCreateOpen(false);
    setSidebarOpen(false);
  };

  const replaceNotification = (nextNotification: NotificationResource) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === nextNotification.id ? nextNotification : notification,
      ),
    );
  };

  const handleAcceptNotification = async (
    notification: NotificationResource,
  ) => {
    setNotificationAction('accept');
    setNotificationError(null);

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
      const nextConversations =
        await pigeonApplication.listConversations(nextSession);

      setSession(nextSession);
      setConversations(nextConversations);
      replaceNotification(result.notification);
      setActiveConversationId(notification.payload.conversationId);
      setNotificationsOpen(false);
    } catch (caught) {
      setNotificationError(
        caught instanceof Error ? caught.message : copy.notifications.error,
      );
    }
    setNotificationAction(null);
  };

  const handleDeclineNotification = async (notificationId: string) => {
    setNotificationAction('decline');
    setNotificationError(null);

    try {
      replaceNotification(
        await pigeonApplication.updateNotification(
          session,
          notificationId,
          'declined',
        ),
      );
    } catch (caught) {
      setNotificationError(
        caught instanceof Error ? caught.message : copy.notifications.error,
      );
    }
    setNotificationAction(null);
  };

  const handleArchiveNotification = (notificationId: string) => {
    setArchivedNotificationIds(
      archivedNotifications.archive(session.identity.id, notificationId),
    );
  };

  return (
    <section className="relative z-10 min-h-screen pt-0 sm:pt-4">
      <div className="mx-auto grid h-screen max-w-[1800px] grid-cols-1 gap-0 px-0 pb-0 sm:h-[calc(100vh-1rem)] sm:gap-3 sm:px-4 sm:pb-4 lg:grid-cols-[82px_330px_minmax(0,1fr)] xl:grid-cols-[82px_330px_minmax(0,1fr)_320px]">
        <Rail
          className="hidden lg:flex"
          notificationCount={pendingNotificationCount}
          onNotificationsClick={() => {
            setNotificationsOpen(true);
            void refreshNotifications();
          }}
          onSettingsClick={() => setNodeSettingsOpen(true)}
          settingsAttention={nodeUnclaimed}
        />

        <div
          className={cx(
            'fixed inset-y-0 left-0 z-40 w-[calc(86vw+82px)] max-w-[442px] p-3 transition lg:static lg:block lg:w-auto lg:max-w-none lg:p-0',
            sidebarOpen ? 'block' : 'hidden lg:block',
          )}
        >
          <div className="grid h-full grid-cols-[82px_minmax(0,1fr)] gap-3 lg:block">
            <Rail
              className="lg:hidden"
              notificationCount={pendingNotificationCount}
              onNotificationsClick={() => {
                setNotificationsOpen(true);
                void refreshNotifications();
              }}
              onSettingsClick={() => setNodeSettingsOpen(true)}
              settingsAttention={nodeUnclaimed}
            />
            <Sidebar
              session={session}
              conversations={conversations}
              identityNames={identityNames}
              identityPictures={identityPictures}
              identityProfiles={identityProfiles}
              nodeNetworks={nodeNetworks}
              activeConversationId={activeConversation?.id ?? null}
              onSelect={(id) => {
                setActiveConversationId(id);
                setSidebarOpen(false);
              }}
              onCreate={() => setIsCreateOpen(true)}
              onClose={() => setSidebarOpen(false)}
              onLogout={() => setSession(null)}
              onSessionUpdated={(nextSession) => {
                setSession(nextSession);
                setIdentityNames((current) => ({
                  ...current,
                  [nextSession.identity.id]:
                    identityName(nextSession.identity) ?? nextSession.identity.id,
                }));
                setIdentityProfiles((current) => ({
                  ...current,
                  [nextSession.identity.id]: nextSession.identity,
                }));
                setIdentityPictures((current) => ({
                  ...current,
                  ...(identityPicture(nextSession.identity)
                    ? {
                        [nextSession.identity.id]: identityPicture(
                          nextSession.identity,
                        ) as string,
                      }
                    : {}),
                }));
              }}
            />
          </div>
        </div>

        {sidebarOpen && (
          <button
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label={copy.workspace.closeSidebar}
          />
        )}

        <ChatColumn
          session={session}
          activeConversation={activeConversation}
          hasConversationKey={!!activeConversationKey}
          peerIdentityId={
            activeConversation
              ? conversationPeerIdentityId(
                  activeConversation,
                  session.identity.id,
                  session.keychain,
                )
              : undefined
          }
          peerIdentity={
            activeConversation
              ? identityProfiles[
                  conversationPeerIdentityId(
                    activeConversation,
                    session.identity.id,
                    session.keychain,
                  ) ?? ''
                ]
              : undefined
          }
          peerPicture={
            activeConversation
              ? identityPictures[
                  conversationPeerIdentityId(
                    activeConversation,
                    session.identity.id,
                    session.keychain,
                  ) ?? ''
                ]
              : undefined
          }
          identityNames={identityNames}
          identityPictures={identityPictures}
          messages={messages}
          messageState={messageState}
          nodeNetworks={nodeNetworks}
          sendError={sendError}
          scrollerRef={scrollerRef}
          bottomRef={bottomRef}
          onScroll={handleScroll}
          onSend={handleSend}
          onOpenSidebar={() => setSidebarOpen(true)}
          onCreate={() => setIsCreateOpen(true)}
          progress={attachmentProgress}
        />

        <Inspector
          session={session}
          activeConversation={activeConversation}
          messages={messages}
        />
      </div>

      {isCreateOpen && (
        <CreateConversationDialog
          session={session}
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleConversationCreated}
        />
      )}

      {notificationsOpen && (
        <NotificationsPanel
          action={notificationAction}
          error={notificationError}
          identityNames={identityNames}
          notifications={visibleNotifications}
          onAccept={(notification) => void handleAcceptNotification(notification)}
          onArchive={handleArchiveNotification}
          onClose={() => setNotificationsOpen(false)}
          onDecline={(notificationId) =>
            void handleDeclineNotification(notificationId)
          }
          onRefresh={() => void refreshNotifications()}
        />
      )}

      {nodeSettingsOpen && (
        <NodeSettingsDialog
          networks={nodeNetworks}
          node={node}
          onClose={() => setNodeSettingsOpen(false)}
          onNetworksUpdated={onNodeNetworksReload}
          session={session}
        />
      )}
    </section>
  );
}
