import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  ChatMessage,
  AttachmentProgress,
  Community,
  ConversationKeyEntry,
  ConversationResource,
  MessageReplyPreview,
  Session,
} from '../../domain/types';
import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { Peer } from '../../application/peers/ListPeers';

import { pigeonApplication } from '../../application/applicationContainer';
import { conversationKeyEntry } from '../../domain/conversations/conversationKey';
import {
  bumpConversationActivity,
  sortConversationsByLatestMessage,
} from '../../domain/conversations/conversationOrdering';
import { conversationPeerIdentityId } from '../../domain/conversations/conversationPeer';
import { copy } from '../../i18n/en';
import { useIdentityDirectory } from '../../presentation/hooks/useIdentityDirectory';
import { useNotifications } from '../../presentation/hooks/useNotifications';
import { useRealtimeEvents } from '../../presentation/hooks/useRealtimeEvents';
import { useUnreadMessages } from '../../presentation/hooks/useUnreadMessages';
import type { RealtimeDomainEvent } from '../../infrastructure/realtime/RealtimeGateway';
import { isBrowserPreviewImage } from '../../utils/browserPreview';
import { cx } from '../../utils/classNameHelper';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { CreateConversationDialog } from '../dialog/CreateConversationDialog';
import { CreateCommunityDialog } from '../community/CreateCommunityDialog';
import { CommunityWorkspace } from '../community/CommunityWorkspace';
import { ChatColumn } from './ChatColumn';
import { Inspector } from './Inspector';
import { NodeSettingsDialog } from './NodeSettingsDialog';
import { NotificationsPanel } from './NotificationsPanel';
import { Rail } from './Rail';
import {
  MessageContextMenu,
  type MessageContextMenuState,
} from './MessageContextMenu';
import { RawMessageDialog } from './RawMessageDialog';
import { Sidebar } from './Sidebar';

type LoadState = 'idle' | 'loading' | 'error';
type ConversationDrafts = Record<string, string>;
type PendingSend = {
  attachments: File[];
  content: string;
  replyTarget: ChatMessage | null;
};
type FailedSends = Record<string, PendingSend>;

const lastConversationStorageKey = (identityId: string) =>
  `pigeon:lastConversation:${identityId}`;
const draftsStorageKey = (identityId: string) =>
  `pigeon:conversationDrafts:${identityId}`;

function initialConversationId(
  conversations: ConversationResource[],
  identityId: string,
): string | null {
  const storedId = globalThis.localStorage?.getItem(
    lastConversationStorageKey(identityId),
  );

  return conversations.some((conversation) => conversation.id === storedId)
    ? storedId
    : (conversations[0]?.id ?? null);
}

function loadDrafts(identityId: string): ConversationDrafts {
  try {
    return JSON.parse(
      globalThis.localStorage?.getItem(draftsStorageKey(identityId)) ?? '{}',
    ) as ConversationDrafts;
  } catch {
    return {};
  }
}

function replyPreviewFromMessage(
  message?: ChatMessage | null,
): MessageReplyPreview | undefined {
  if (!message) return undefined;

  const image = message.attachments.find((attachment) =>
    isBrowserPreviewImage(attachment.contentType),
  );

  return {
    authorIdentityId: message.authorIdentityId,
    ...(message.content ? { content: message.content.slice(0, 180) } : {}),
    ...(image ? { image } : {}),
    messageId: message.id,
  };
}

interface GlassWorkspaceProps {
  session: Session;
  setSession: (session: Session | null) => void;
  conversations: ConversationResource[];
  communities: Community[];
  node: { id: string; owner: null | string } | null;
  nodeNetworks: NodeNetwork[];
  onCommunitiesReload: () => Promise<void>;
  onNodeNetworksReload: () => Promise<void>;
  onPeersReload: () => Promise<void>;
  peers: Peer[];
  setCommunities: Dispatch<SetStateAction<Community[]>>;
  setConversations: Dispatch<SetStateAction<ConversationResource[]>>;
}

export function GlassWorkspace({
  conversations,
  communities,
  node,
  nodeNetworks,
  onCommunitiesReload,
  onNodeNetworksReload,
  onPeersReload,
  peers,
  session,
  setCommunities,
  setConversations,
  setSession,
}: GlassWorkspaceProps) {
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(() => initialConversationId(conversations, session.identity.id));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<LoadState>('idle');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<'community' | 'messages'>(
    'messages',
  );
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(
    null,
  );
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentProgress, setAttachmentProgress] =
    useState<AttachmentProgress | null>(null);
  const [messageContextMenu, setMessageContextMenu] =
    useState<MessageContextMenuState | null>(null);
  const [rawMessage, setRawMessage] = useState<ChatMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [drafts, setDrafts] = useState<ConversationDrafts>(() =>
    loadDrafts(session.identity.id),
  );
  const [failedSends, setFailedSends] = useState<FailedSends>({});
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [nodeSettingsOpen, setNodeSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const keepMessageBottomUntilRef = useRef(0);
  const messageCursorRef = useRef<string | null>(null);
  const messageRequestRef = useRef(0);

  const updateMessageCursor = useCallback((cursor: null | string) => {
    messageCursorRef.current = cursor;
    setMessageCursor(cursor);
  }, []);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ) ?? conversations[0],
    [activeConversationId, conversations],
  );
  const activeConversationDraft = activeConversation?.id
    ? (drafts[activeConversation.id] ?? '')
    : '';
  const activeCommunity = useMemo(
    () =>
      communities.find((community) => community.id === activeCommunityId) ??
      communities[0],
    [activeCommunityId, communities],
  );
  const updateActiveConversationDraft = useCallback(
    (value: string) => {
      if (!activeConversation?.id) return;

      setDrafts((current) => ({
        ...current,
        [activeConversation.id]: value,
      }));
    },
    [activeConversation?.id],
  );
  const {
    clearUnreadMessages,
    conversationsWithUnread,
    markUnreadMessage,
  } = useUnreadMessages(conversations);
  const unreadMessageCount = useMemo(
    () =>
      conversationsWithUnread.reduce(
        (total, conversation) => total + conversation.unreadCount,
        0,
      ),
    [conversationsWithUnread],
  );
  const handleNotificationAccepted = useCallback(
    (next: {
      conversationId: string;
      conversations: ConversationResource[];
      session: Session;
    }) => {
      setSession(next.session);
      setConversations(next.conversations);
      setActiveConversationId(next.conversationId);
    },
    [setConversations, setSession],
  );
  const {
    accept: acceptNotification,
    action: notificationAction,
    archive: archiveNotification,
    decline: declineNotification,
    error: notificationError,
    list: notificationList,
    pendingCount: pendingNotificationCount,
    refresh: refreshNotifications,
    visible: visibleNotifications,
  } = useNotifications({
    onAccepted: handleNotificationAccepted,
    onAcceptedPanelClose: () => setNotificationsOpen(false),
    session,
  });
  const nodeUnclaimed = !node?.owner;
  const activeConversationKey = activeConversation
    ? conversationKeyEntry(
        session.keychain,
        session.identity.id,
        activeConversation.id,
      )
    : undefined;
  const activeConversationKeyId = activeConversationKey?.conversationId ?? null;
  const activeConversationPeerIdentityId = activeConversation
    ? conversationPeerIdentityId(
        activeConversation,
        session.identity.id,
        session.keychain,
      )
    : undefined;
  const {
    identityNames,
    identityPictures,
    identityProfiles,
    rememberIdentity,
  } = useIdentityDirectory({
    conversations,
    messages,
    notifications: notificationList,
    session,
  });

  useEffect(() => {
    if (!activeConversationId && conversations[0])
      setActiveConversationId(conversations[0].id);
    if (
      activeConversationId &&
      conversations.length > 0 &&
      !conversations.some((conversation) => conversation.id === activeConversationId)
    ) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  useEffect(() => {
    setDrafts(loadDrafts(session.identity.id));
  }, [session.identity.id]);

  useEffect(() => {
    globalThis.localStorage?.setItem(
      draftsStorageKey(session.identity.id),
      JSON.stringify(drafts),
    );
  }, [drafts, session.identity.id]);

  useEffect(() => {
    if (!activeConversation?.id) return;

    globalThis.localStorage?.setItem(
      lastConversationStorageKey(session.identity.id),
      activeConversation.id,
    );
  }, [activeConversation?.id, session.identity.id]);

  const refreshConversations = useCallback(async () => {
    const next = await pigeonApplication.listConversations(session);
    setConversations(next);
  }, [session, setConversations]);

  const refreshSession = useCallback(async () => {
    const result = await pigeonApplication.login(
      session.identity.id,
      session.password,
    );

    setSession(result.session);
    setConversations(result.conversations);
  }, [session.identity.id, session.password, setConversations, setSession]);

  const scrollMessagesToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto', keepPinned = false) => {
      const scroll = () => {
        bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
        lastScrollTopRef.current = scrollerRef.current?.scrollTop ?? 0;
      };

      if (keepPinned) {
        keepMessageBottomUntilRef.current = Date.now() + 5000;
      }

      requestAnimationFrame(() => {
        scroll();
        requestAnimationFrame(scroll);
        window.setTimeout(scroll, 120);
        window.setTimeout(scroll, 450);
      });
    },
    [],
  );
  const isScrolledNearBottom = useCallback(() => {
    const scroller = scrollerRef.current;

    if (!scroller) return true;

    return (
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 96
    );
  }, []);
  const jumpToLatestMessages = useCallback(() => {
    setNewMessageCount(0);
    scrollMessagesToBottom('smooth');
  }, [scrollMessagesToBottom]);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) return undefined;

    const handleMediaLayoutChange = () => {
      if (Date.now() > keepMessageBottomUntilRef.current) return;

      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: 'end' });
        lastScrollTopRef.current = scroller.scrollTop;
      });
    };

    scroller.addEventListener('load', handleMediaLayoutChange, true);
    scroller.addEventListener('loadedmetadata', handleMediaLayoutChange, true);
    scroller.addEventListener('canplay', handleMediaLayoutChange, true);

    return () => {
      scroller.removeEventListener('load', handleMediaLayoutChange, true);
      scroller.removeEventListener(
        'loadedmetadata',
        handleMediaLayoutChange,
        true,
      );
      scroller.removeEventListener('canplay', handleMediaLayoutChange, true);
    };
  }, []);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const closeTransientUi = useCallback(() => {
    setMessageContextMenu(null);
    setRawMessage(null);
    setReplyTarget(null);
    setIsCreateOpen(false);
    setIsCreateCommunityOpen(false);
    setNotificationsOpen(false);
    setNodeSettingsOpen(false);
    setInspectorOpen(false);
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTransientUi();
    };

    window.addEventListener('keydown', handleEscape);

    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeTransientUi]);

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
        updateMessageCursor(result.nextCursor ?? null);
        scrollMessagesToBottom('auto', true);
      } catch (caught) {
        if (messageRequestRef.current !== requestId) return;

        setMessages([]);
        setMessageState('error');
        setSendError(
          toUserErrorMessage(caught, copy.workspace.loadMessagesError),
        );

        return;
      }
      if (messageRequestRef.current !== requestId) return;

      setMessageState('idle');
    },
    [scrollMessagesToBottom, session, updateMessageCursor],
  );

  useEffect(() => {
    if (!activeConversation?.id) return;
    setReplyTarget(null);
    setNewMessageCount(0);

    if (!activeConversationKeyId) {
      setMessages([]);
      updateMessageCursor(null);
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
      !messageCursorRef.current ||
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
        messageCursorRef.current,
      );
      if (messageRequestRef.current !== requestId) return;

      setMessages((current) => [...result.messages, ...current]);
      updateMessageCursor(result.nextCursor ?? null);
      requestAnimationFrame(() => {
        if (!scrollerRef.current) return;

        const nextTop =
          scrollerRef.current.scrollHeight - previousHeight + previousTop;

        scrollerRef.current.scrollTop = nextTop;
        lastScrollTopRef.current = nextTop;
      });
    } catch (caught) {
      setSendError(
        toUserErrorMessage(caught, copy.workspace.loadOlderError),
      );
    }
    if (messageRequestRef.current !== requestId) return;

    setMessageState('idle');
  };

  const handleScroll = () => {
    const scrollTop = scrollerRef.current?.scrollTop ?? 0;
    const isScrollingUp = scrollTop < lastScrollTopRef.current;

    lastScrollTopRef.current = scrollTop;
    if (isScrolledNearBottom()) setNewMessageCount(0);

    if (isScrollingUp && scrollTop < 80) void handleLoadOlder();
  };

  const sendPendingMessage = async (payload: PendingSend) => {
    if (!activeConversation?.id) return;
    const optimisticTimestamp = Date.now();
    const optimisticId = `pending:${activeConversation.id}:${optimisticTimestamp}:${crypto.randomUUID()}`;

    setSendError(null);
    setAttachmentProgress(null);
    setConversations((current) =>
      bumpConversationActivity(
        current,
        activeConversation.id,
        optimisticTimestamp,
      ),
    );
    setFailedSends((current) => {
      const next = { ...current };

      delete next[optimisticId];

      return next;
    });
    setMessages((current) => [
      ...current,
      {
        attachments: [],
        authorIdentityId: session.identity.id,
        content:
          payload.content ||
          payload.attachments.map((attachment) => attachment.name).join(', '),
        deliveryStatus: 'pending',
        encrypted: false,
        id: optimisticId,
        mine: true,
        raw: { id: optimisticId, type: 'sent' },
        replyPreview: replyPreviewFromMessage(payload.replyTarget),
        replyToMessageId: payload.replyTarget?.id,
        timestamp: optimisticTimestamp,
      },
    ]);
    scrollMessagesToBottom('smooth');

    try {
      const lastMessageId = [...messages]
        .reverse()
        .find((message) => !message.deliveryStatus)?.id;
      const sent = await pigeonApplication.sendMessage(
        session,
        activeConversation.id,
        payload.content,
        {
          attachments: payload.attachments,
          onAttachmentProgress: setAttachmentProgress,
          previousMessageIds: lastMessageId ? [lastMessageId] : [],
          replyPreview: replyPreviewFromMessage(payload.replyTarget),
          replyToMessageId: payload.replyTarget?.id,
        },
      );
      setMessages((current) =>
        mergeMessages(
          current.filter((message) => message.id !== optimisticId),
          [sent],
        ),
      );
      setConversations((current) =>
        bumpConversationActivity(current, activeConversation.id, sent.timestamp),
      );
      setAttachmentProgress(null);
      scrollMessagesToBottom('smooth');
    } catch (caught) {
      setSendError(toUserErrorMessage(caught, copy.workspace.sendError));
      setFailedSends((current) => ({ ...current, [optimisticId]: payload }));
      setMessages((current) =>
        current.map((message) =>
          message.id === optimisticId
            ? { ...message, deliveryStatus: 'failed' }
            : message,
        ),
      );
      setAttachmentProgress(null);
    }
  };

  const handleSend = async (content: string, attachments: File[]) => {
    const payload = { attachments, content, replyTarget };

    setReplyTarget(null);
    await sendPendingMessage(payload);
  };

  const retryMessage = (message: ChatMessage) => {
    const payload = failedSends[message.id];

    if (!payload) return;

    setFailedSends((current) => {
      const next = { ...current };

      delete next[message.id];

      return next;
    });
    setMessages((current) => current.filter((item) => item.id !== message.id));
    void sendPendingMessage(payload);
  };

  const handleMessageMenuOpen = (
    message: ChatMessage,
    x: number,
    y: number,
  ) => {
    setMessageContextMenu({
      message,
      x,
      y,
    });
  };

  const scrollToMessage = (messageId: string) => {
    requestAnimationFrame(() => {
      const element = scrollerRef.current?.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(messageId)}"]`,
      );

      if (!element) return;

      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('message-focus-ring');
      window.setTimeout(
        () => element.classList.remove('message-focus-ring'),
        1600,
      );
    });
  };

  const handleReplyReferenceClick = async (messageId: string) => {
    if (messages.some((message) => message.id === messageId)) {
      scrollToMessage(messageId);
      return;
    }

    if (!activeConversation?.id || !activeConversationKey) return;

    setSendError(null);
    setMessageState('loading');
    try {
      const result = await pigeonApplication.loadMessagesAround(
        session,
        activeConversation.id,
        messageId,
      );

      setMessages((current) => mergeMessages(current, result.messages));
      updateMessageCursor(result.previousCursor ?? null);

      if (result.messages.some((message) => message.id === messageId)) {
        scrollToMessage(messageId);
        return;
      }

      setSendError(copy.messages.replyTargetNotFound);
    } catch (caught) {
      setSendError(
        toUserErrorMessage(caught, copy.workspace.loadOlderError),
      );
    } finally {
      setMessageState('idle');
    }
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!activeConversation?.id) return;

    setMessageContextMenu(null);
    setSendError(null);
    try {
      await pigeonApplication.deleteMessage(
        session,
        activeConversation.id,
        message.id,
      );
      setMessages((current) =>
        current.filter((item) => item.id !== message.id),
      );
    } catch (caught) {
      setSendError(toUserErrorMessage(caught, copy.messages.deleteError));
    }
  };

  const handleConversationCreated = (
    nextSession: Session,
    conversation: ConversationResource,
  ) => {
    setSession(nextSession);
    setConversations(
      sortConversationsByLatestMessage([
        conversation,
        ...conversations.filter((item) => item.id !== conversation.id),
      ]),
    );
    setActiveConversationId(conversation.id);
    setIsCreateOpen(false);
    setSidebarOpen(false);
  };

  const handleConversationKeyImported = async (
    keyEntry: ConversationKeyEntry,
  ) => {
    const result = await pigeonApplication.publishKeychain(session, {
      ...session.keychain,
      conversations: {
        ...session.keychain.conversations,
        [keyEntry.conversationId]: keyEntry,
      },
    });

    setSession({
      ...session,
      keychain: result.keychain,
      keychainExternalIdentifier: result.keychainExternalIdentifier,
    });
  };

  const refreshRealtimeViews = useCallback(() => {
    void refreshNotifications();
    void refreshConversations().catch(() => undefined);
    void onCommunitiesReload().catch(() => undefined);
    void onPeersReload().catch(() => undefined);

    if (activeConversation?.id && activeConversationKeyId) {
      void loadActiveMessages(activeConversation.id);
    }
  }, [
    activeConversation?.id,
    activeConversationKeyId,
    loadActiveMessages,
    onCommunitiesReload,
    onPeersReload,
    refreshConversations,
    refreshNotifications,
  ]);

  const fetchRealtimeMessage = useCallback(
    async (
      conversationId: string,
      messageId: string,
      shouldAutoScroll: boolean,
    ) => {
      try {
        const message = await pigeonApplication.loadMessage(
          session,
          conversationId,
          messageId,
        );

        if (!message) return;

        setMessages((current) => mergeMessages(current, [message]));
        if (shouldAutoScroll) {
          scrollMessagesToBottom('smooth', true);
        } else {
          setNewMessageCount((current) => current + 1);
        }
      } catch (caught) {
        setSendError(
          toUserErrorMessage(caught, copy.workspace.loadMessagesError),
        );
      }
    },
    [scrollMessagesToBottom, session],
  );
  const handleRealtimeEvent = useCallback(
    (event: RealtimeDomainEvent) => {
      if (event.type.startsWith('nodes.')) {
        void onPeersReload().catch(() => undefined);
        return;
      }

      if (event.type.startsWith('notifications.')) {
        void refreshNotifications();
        return;
      }

      if (event.type.startsWith('keychains.')) {
        void refreshSession().catch(() => undefined);
        return;
      }

      if (event.type.startsWith('identities.')) {
        if (event.aggregate_id === session.identity.id) {
          void pigeonApplication
            .getIdentity(session.identity.id)
            .then((identity) => setSession({ ...session, identity }))
            .catch(() => undefined);
        }
        return;
      }

      if (event.type.startsWith('communities.')) {
        void onCommunitiesReload().catch(() => undefined);
        return;
      }

      if (event.type.startsWith('conversations.v1.conversation.')) {
        void refreshConversations().catch(() => undefined);
        return;
      }

      if (event.type.startsWith('conversations.v1.message.')) {
        void refreshConversations().catch(() => undefined);
        const conversationId = eventAggregateId(event);
        const messageId = stringAttribute(event, 'messageId', 'message_id');
        const authorId = stringAttribute(event, 'authorId', 'author_id');
        const isActiveConversation =
          !!conversationId && conversationId === activeConversation?.id;

        if (!messageId || !conversationId) return;

        setConversations((current) =>
          bumpConversationActivity(current, conversationId, event.occurred_on),
        );

        if (!isActiveConversation && authorId !== session.identity.id) {
          markUnreadMessage(conversationId, messageId);
        }

        if (isActiveConversation) {
          clearUnreadMessages(conversationId);

          if (event.type.endsWith('.was_deleted')) {
            const targetMessageId = stringAttribute(
              event,
              'targetMessageId',
              'target_message_id',
            );

            if (targetMessageId) {
              setMessages((current) =>
                current.filter((message) => message.id !== targetMessageId),
              );
            }

            return;
          }

          if (
            !activeConversationKeyId ||
            messages.some((message) => message.id === messageId)
          ) {
            return;
          }

          void fetchRealtimeMessage(
            conversationId,
            messageId,
            isScrolledNearBottom() || authorId === session.identity.id,
          );
        }
      }
    },
    [
      activeConversation?.id,
      activeConversationKeyId,
      clearUnreadMessages,
      fetchRealtimeMessage,
      isScrolledNearBottom,
      markUnreadMessage,
      messages,
      onCommunitiesReload,
      onPeersReload,
      refreshConversations,
      refreshNotifications,
      refreshSession,
      session,
      setConversations,
      setSession,
    ],
  );

  useRealtimeEvents(session, {
    onConnected: refreshRealtimeViews,
    onDomainEvent: handleRealtimeEvent,
  });

  return (
    <section className="relative z-10 min-h-screen pt-0 sm:pt-4">
      <div className="mx-auto grid h-screen max-w-[1800px] grid-cols-1 gap-0 px-0 pb-0 sm:h-[calc(100vh-1rem)] sm:gap-3 sm:px-4 sm:pb-4 lg:grid-cols-[82px_330px_minmax(0,1fr)] xl:grid-cols-[82px_330px_minmax(0,1fr)_320px]">
        <Rail
          className="hidden lg:flex"
          activeCommunityId={workspaceMode === 'community' ? activeCommunity?.id : null}
          communities={communities}
          messageNotificationCount={unreadMessageCount}
          notificationCount={pendingNotificationCount}
          onCommunityClick={(communityId) => {
            setActiveCommunityId(communityId);
            setWorkspaceMode('community');
            setSidebarOpen(false);
          }}
          onCreateCommunityClick={() => setIsCreateCommunityOpen(true)}
          onMessagesClick={() => {
            setWorkspaceMode('messages');
            setSidebarOpen(false);
          }}
          onNotificationsClick={() => setNotificationsOpen(true)}
          onSettingsClick={() => setNodeSettingsOpen(true)}
          settingsAttention={nodeUnclaimed}
        />

        {workspaceMode === 'messages' ? (
          <>
            <div
              className={cx(
                'fixed inset-y-0 left-0 z-40 w-[calc(86vw+82px)] max-w-[442px] p-3 transition lg:static lg:block lg:w-auto lg:max-w-none lg:p-0',
                sidebarOpen ? 'block' : 'hidden lg:block',
              )}
            >
              <div className="grid h-full grid-cols-[82px_minmax(0,1fr)] gap-3 lg:block">
                <Rail
                  className="lg:hidden"
                  activeCommunityId={null}
                  communities={communities}
                  messageNotificationCount={unreadMessageCount}
                  notificationCount={pendingNotificationCount}
                  onCommunityClick={(communityId) => {
                    setActiveCommunityId(communityId);
                    setWorkspaceMode('community');
                    setSidebarOpen(false);
                  }}
                  onCreateCommunityClick={() => setIsCreateCommunityOpen(true)}
                  onMessagesClick={() => {
                    setWorkspaceMode('messages');
                    setSidebarOpen(false);
                  }}
                  onNotificationsClick={() => setNotificationsOpen(true)}
                  onSettingsClick={() => setNodeSettingsOpen(true)}
                  onInspectorClick={() => setInspectorOpen(true)}
                  peerCount={peers.length}
                  settingsAttention={nodeUnclaimed}
                />
              <Sidebar
                session={session}
                conversations={conversationsWithUnread}
                identityNames={identityNames}
                identityPictures={identityPictures}
                identityProfiles={identityProfiles}
                nodeNetworks={nodeNetworks}
                activeConversationId={activeConversation?.id ?? null}
                onSelect={(id) => {
                  clearUnreadMessages(id);
                  setNewMessageCount(0);
                  setActiveConversationId(id);
                  setSidebarOpen(false);
                }}
                onCreate={() => setIsCreateOpen(true)}
                onClose={() => setSidebarOpen(false)}
                onLogout={() => setSession(null)}
                onSessionUpdated={(nextSession) => {
                  setSession(nextSession);
                  rememberIdentity(nextSession.identity);
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
              conversationKey={activeConversationKey}
              draft={activeConversationDraft}
              hasConversationKey={!!activeConversationKey}
              hasReachedMessageStart={!messageCursor}
              peerIdentityId={activeConversationPeerIdentityId}
              peerIdentity={
                activeConversationPeerIdentityId
                  ? identityProfiles[activeConversationPeerIdentityId]
                  : undefined
              }
              peerPicture={
                activeConversationPeerIdentityId
                  ? identityPictures[activeConversationPeerIdentityId]
                  : undefined
              }
              identityNames={identityNames}
              identityPictures={identityPictures}
              identityProfiles={identityProfiles}
              messages={messages}
              messageState={messageState}
              newMessageCount={newMessageCount}
              nodeNetworks={nodeNetworks}
              sendError={sendError}
              scrollerRef={scrollerRef}
              bottomRef={bottomRef}
              onScroll={handleScroll}
              onSend={handleSend}
              onConversationKeyImported={handleConversationKeyImported}
              onDraftChange={updateActiveConversationDraft}
              onEscape={closeTransientUi}
              onJumpToLatest={jumpToLatestMessages}
              onMessageMenuOpen={handleMessageMenuOpen}
              onReplyReferenceClick={(messageId) =>
                void handleReplyReferenceClick(messageId)
              }
              onOpenSidebar={() => setSidebarOpen(true)}
              onCreate={() => setIsCreateOpen(true)}
              progress={attachmentProgress}
              replyToMessage={replyTarget}
              onCancelReply={() => setReplyTarget(null)}
              onRetryMessage={retryMessage}
            />

            <Inspector
              className="hidden xl:block"
              session={session}
              activeConversation={activeConversation}
              messages={messages}
              peers={peers}
            />
          </>
        ) : activeCommunity ? (
          <CommunityWorkspace
            community={activeCommunity}
            mobileSidebarOpen={sidebarOpen}
            nodeNetworks={nodeNetworks}
            onCommunityUpdated={(community) =>
              setCommunities((current) =>
                current.map((item) =>
                  item.id === community.id ? community : item,
                ),
              )
            }
            onMobileSidebarClose={() => setSidebarOpen(false)}
            onOpenMobileSidebar={() => setSidebarOpen(true)}
            session={session}
          />
        ) : (
          <div className="glass-panel-strong col-span-3 flex h-full flex-col justify-center rounded-none p-4 text-center text-sm text-white/55 sm:rounded-[2rem]">
            {copy.communities.empty}
          </div>
        )}
      </div>

      {inspectorOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/50 xl:hidden"
            onClick={() => setInspectorOpen(false)}
            aria-label={copy.dialog.close}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-[86vw] max-w-[360px] p-3 xl:hidden">
            <Inspector
              className="h-full overflow-y-auto"
              session={session}
              activeConversation={activeConversation}
              messages={messages}
              onClose={() => setInspectorOpen(false)}
              peers={peers}
            />
          </div>
        </>
      )}

      {messageContextMenu && (
        <MessageContextMenu
          menu={messageContextMenu}
          onClose={() => setMessageContextMenu(null)}
          onDelete={
            messageContextMenu.message.authorIdentityId === session.identity.id
              ? () => void handleDeleteMessage(messageContextMenu.message)
              : undefined
          }
          onReply={() => {
            setReplyTarget(messageContextMenu.message);
            setMessageContextMenu(null);
          }}
          onViewRaw={() => {
            setRawMessage(messageContextMenu.message);
            setMessageContextMenu(null);
          }}
        />
      )}

      {rawMessage && (
        <RawMessageDialog
          message={rawMessage}
          onClose={() => setRawMessage(null)}
        />
      )}

      {isCreateOpen && (
        <CreateConversationDialog
          nodeNetworks={nodeNetworks}
          session={session}
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleConversationCreated}
        />
      )}

      {isCreateCommunityOpen && (
        <CreateCommunityDialog
          nodeNetworks={nodeNetworks}
          session={session}
          onClose={() => setIsCreateCommunityOpen(false)}
          onCreated={(community) => {
            setCommunities((current) => [community, ...current]);
            setActiveCommunityId(community.id);
            setWorkspaceMode('community');
            setIsCreateCommunityOpen(false);
          }}
        />
      )}

      {notificationsOpen && (
        <NotificationsPanel
          action={notificationAction}
          error={notificationError}
          identityNames={identityNames}
          notifications={visibleNotifications}
          onAccept={(notification) => void acceptNotification(notification)}
          onArchive={archiveNotification}
          onClose={() => setNotificationsOpen(false)}
          onDecline={(notificationId) =>
            void declineNotification(notificationId)
          }
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

function mergeMessages(
  currentMessages: ChatMessage[],
  incomingMessages: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();

  for (const message of currentMessages) byId.set(message.id, message);
  for (const message of incomingMessages) byId.set(message.id, message);

  return [...byId.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function stringAttribute(
  event: RealtimeDomainEvent,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = event.attributes[key];

    if (typeof value === 'string' && value.length > 0) return value;
  }

  return undefined;
}

function eventAggregateId(event: RealtimeDomainEvent): string | undefined {
  const aggregateId =
    event.aggregate_id ??
    (event as RealtimeDomainEvent & { aggregateId?: string }).aggregateId;

  return typeof aggregateId === 'string' && aggregateId.length > 0
    ? aggregateId
    : undefined;
}
