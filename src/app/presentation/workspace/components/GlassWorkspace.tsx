import {
  type Dispatch,
  type SetStateAction,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { PendingCommunityInviteLink } from '../../../../contexts/communities/presentation/view-models/communityInviteLink';
import type { NodeInfo } from '../../../../contexts/networks/infrastructure/http/NodeInfo';
import type { NetworkSynchronizationStatus } from '../../../../contexts/networks/presentation/view-models/NetworkSynchronizationStatus';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type { Peer } from '../../../../contexts/networks/presentation/view-models/Peer';
import type {
  ChatMessage,
  AttachmentProgress,
  Community,
  ConversationResource,
  NotificationSettingScope,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { PreloadedConversationMessages } from '../PreloadedConversationMessages';
import type { MessageContextMenuState } from './messageContextMenu';

import { useRealtimeEvents } from '../../../../app/presentation/realtime/useRealtimeEvents';
import { useAttachmentDownload } from '../../../../contexts/attachments/presentation/hooks/useAttachmentDownload';
import { ConversationPeer } from '../../../../contexts/conversations/presentation/view-models/ConversationPeer';
import { ConversationKeychain } from '../../../../contexts/identities/infrastructure/keychain/ConversationKeychain';
import { useIdentityDirectory } from '../../../../contexts/identities/presentation/hooks/useIdentityDirectory';
import {
  identityDisplayName,
  identityPrimaryDisplayName,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { MessageCollectionDialog } from '../../../../contexts/messages/presentation/components/MessageCollectionDialog';
import { MessageThreadPanel } from '../../../../contexts/messages/presentation/components/MessageThreadPanel';
import { useUnreadMessages } from '../../../../contexts/messages/presentation/hooks/useUnreadMessages';
import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { useNotificationScopeSettings } from '../../../../contexts/notifications/presentation/hooks/useNotificationScopeSettings';
import { usePushNotificationRegistration } from '../../../../contexts/notifications/presentation/hooks/usePushNotificationRegistration';
import { deletePwaPushSubscription } from '../../../../contexts/notifications/presentation/services/pwaNotifications';
import { NotificationSettingsPolicy } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';
import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { runWhenBrowserIdle } from '../../../../shared/presentation/runWhenBrowserIdle';
import { playNotificationSound } from '../../../../shared/presentation/sounds';
import { applicationContainer } from '../../../composition/applicationContainer';
import {
  useWorkspacePreferences,
  useWorkspacePreferenceState,
} from '../useWorkspacePreferences';
import { ChatColumn } from './ChatColumn';
import { CommunityUnreadState } from './CommunityUnreadState';
import { communityVoiceChannelTopologyKey } from './communityVoicePresence';
import { CommunityWorkspaceStartupFallback } from './CommunityWorkspaceStartupFallback';
import { type EditingMessage } from './conversationThreadState';
import { PushNotificationPrompt } from './PushNotificationPrompt';
import { Rail, type RailProps } from './Rail';
import { useCommunitySelection } from './useCommunitySelection';
import { useConversationDrafts } from './useConversationDrafts';
import { useConversationMessageActions } from './useConversationMessageActions';
import { useConversationPins } from './useConversationPins';
import { useConversationThread } from './useConversationThread';
import { useConversationTimeline } from './useConversationTimeline';
import { usePendingCommunityInvite } from './usePendingCommunityInvite';
import { useSidebarGesture } from './useSidebarGesture';
import { useWorkspaceCalls } from './useWorkspaceCalls';
import { useWorkspaceCommunityActions } from './useWorkspaceCommunityActions';
import { useWorkspaceConversationNavigation } from './useWorkspaceConversationNavigation';
import { useWorkspaceInbox } from './useWorkspaceInbox';
import { useWorkspaceNotificationActions } from './useWorkspaceNotificationActions';
import { useWorkspacePresence } from './useWorkspacePresence';
import { useWorkspaceRealtimeCommunityEvents } from './useWorkspaceRealtimeCommunityEvents';
import { useWorkspaceRealtimeConversationEvents } from './useWorkspaceRealtimeConversationEvents';
import { useWorkspaceRealtimeEventRouter } from './useWorkspaceRealtimeEventRouter';
import { useWorkspaceTransientUi } from './useWorkspaceTransientUi';
import { useWorkspaceTyping } from './useWorkspaceTyping';
import {
  CommunityWorkspace,
  Inspector,
  InspectorStartupFallback,
  preloadCommunityWorkspace,
  Sidebar,
  SidebarStartupFallback,
  WorkspaceDialogs,
} from './workspaceLazyComponents';
import {
  isPendingCommunityInvitationFor,
  isPendingConversationInvitationFor,
  stableUniqueKey,
} from './workspaceNotificationState';

interface GlassWorkspaceProps {
  session: Session;
  setSession: (session: Session | null) => void;
  conversations: ConversationResource[];
  communities: Community[];
  communitiesError: Error | null;
  communitiesLoading: boolean;
  node: (NodeInfo & { owner: null | string }) | null;
  nodeNetworks: NodeNetwork[];
  onCommunitiesReload: () => Promise<void>;
  onNodeNetworksReload: () => Promise<void>;
  onPeersReload: () => Promise<void>;
  onPendingCommunityInviteHandled?: () => void;
  pendingCommunityInvite?: PendingCommunityInviteLink | null;
  peersLoading: boolean;
  peers: Peer[];
  preloadedConversationMessages: PreloadedConversationMessages | null;
  setCommunities: Dispatch<SetStateAction<Community[]>>;
  setConversations: Dispatch<SetStateAction<ConversationResource[]>>;
}

export function GlassWorkspace({
  communities,
  communitiesError,
  communitiesLoading,
  conversations,
  node,
  nodeNetworks,
  onCommunitiesReload,
  onNodeNetworksReload,
  onPeersReload,
  onPendingCommunityInviteHandled,
  peers,
  peersLoading,
  pendingCommunityInvite,
  preloadedConversationMessages,
  session,
  setCommunities,
  setConversations,
  setSession,
}: GlassWorkspaceProps) {
  const {
    activeCommunityId,
    activeConversationId,
    communityChannelById,
    communityUnreadCountsById,
    drafts,
    draftsHydrated,
    setActiveCommunityId,
    setActiveConversationId,
    setCommunityChannelById,
    setCommunityUnreadCountsById,
    setDrafts,
    setWorkspaceMode,
    workspaceMode,
  } = useWorkspacePreferenceState(conversations, session);
  const [communityRealtimeEvent, setCommunityRealtimeEvent] =
    useState<RealtimeDomainEvent | null>(null);
  const [conversationRealtimeEvent, setConversationRealtimeEvent] =
    useState<RealtimeDomainEvent | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<
    'connected' | 'reconnecting'
  >('reconnecting');
  const [realtimeEventLog, setRealtimeEventLog] = useState<
    RealtimeDomainEvent[]
  >([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentProgress, setAttachmentProgress] =
    useState<AttachmentProgress | null>(null);
  const { openAttachment: downloadContextAttachment } = useAttachmentDownload({
    errorMessage: copy.composer.attachmentDownloadError,
    onErrorChange: setSendError,
    onProgressChange: setAttachmentProgress,
  });
  const [messageContextMenu, setMessageContextMenu] =
    useState<MessageContextMenuState | null>(null);
  const [rawMessage, setRawMessage] = useState<ChatMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(
    null,
  );
  const [groupInviteRequest, setGroupInviteRequest] = useState(0);
  const [networkSynchronizationStatus, setNetworkSynchronizationStatus] =
    useState<NetworkSynchronizationStatus | null>(null);
  const {
    close: closeTransientSurface,
    closeAll: closeAllTransientSurfaces,
    isOpen: isTransientSurfaceOpen,
    open: openTransientSurface,
  } = useWorkspaceTransientUi();
  const communityMembersOpen = isTransientSurfaceOpen('community-members');
  const inspectorOpen = isTransientSurfaceOpen('inspector');
  const isCreateCommunityOpen = isTransientSurfaceOpen('community-creation');
  const isCreateOpen = isTransientSurfaceOpen('conversation-creation');
  const nodeSettingsOpen = isTransientSurfaceOpen('node-settings');
  const notificationsOpen = isTransientSurfaceOpen('notifications');
  const realtimeEventsOpen = isTransientSurfaceOpen('realtime-events');
  const sidebarOpen = isTransientSurfaceOpen('sidebar');
  const {
    dismissPrompt: dismissPushPrompt,
    enable: enablePushNotifications,
    enableError: pushEnableError,
    enableState: pushEnableState,
    permission: pushPermission,
    promptDismissed: pushPromptDismissed,
    promptReady: pushPromptReady,
  } = usePushNotificationRegistration(session);
  const communityVoiceTopologyKey = useMemo(
    () => communityVoiceChannelTopologyKey(communities),
    [communities],
  );
  const initialRenderedCommunityIdRef = useRef<string | null>(null);
  const sessionRef = useRef(session);
  const suppressMessageLoadsUntilRef = useRef(0);
  const {
    clearSidebarGesture,
    handleWorkspacePointerDown,
    handleWorkspacePointerMove,
  } = useSidebarGesture(sidebarOpen, () => openTransientSurface('sidebar'));
  const {
    close: closeNotificationSettings,
    error: notificationSettingsError,
    open: openNotificationSettings,
    reset: resetNotificationSetting,
    save: saveNotificationSetting,
    setting: notificationSettingsSetting,
    settingsByScopeKey: notificationSettingsByScopeKey,
    settingsRef: notificationSettingsRef,
    target: notificationSettingsTarget,
    toggleMute: toggleNotificationMute,
  } = useNotificationScopeSettings({ session });

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const suppressMessageLoadsBriefly = useCallback((): void => {
    suppressMessageLoadsUntilRef.current = Date.now() + 800;
  }, []);

  const openNotificationsPanel = useCallback(() => {
    suppressMessageLoadsBriefly();
    void enablePushNotifications();
    openTransientSurface('notifications');
  }, [
    enablePushNotifications,
    openTransientSurface,
    suppressMessageLoadsBriefly,
  ]);

  const closeNotificationsPanel = useCallback(() => {
    suppressMessageLoadsBriefly();
    closeTransientSurface('notifications');
  }, [closeTransientSurface, suppressMessageLoadsBriefly]);
  const openNodeSettings = useCallback(() => {
    openTransientSurface('node-settings');
    void onPeersReload();
  }, [onPeersReload, openTransientSurface]);

  const openRealtimeEvents = useCallback(() => {
    setRealtimeEventLog([]);
    openTransientSurface('realtime-events');
  }, [openTransientSurface]);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ) ?? conversations[0],
    [activeConversationId, conversations],
  );
  const {
    activeDraft: activeConversationDraft,
    updateActiveDraft: updateActiveConversationDraft,
  } = useConversationDrafts({
    activeConversationId: activeConversation?.id ?? null,
    drafts,
    onDraftsChange: setDrafts,
    session,
  });
  const activeConversationNotificationScope = useMemo(
    () =>
      activeConversation
        ? ({
            conversationId: activeConversation.id,
            type: 'conversation',
          } satisfies NotificationSettingScope)
        : null,
    [activeConversation],
  );
  const activeConversationNotificationSetting = useMemo(
    () =>
      activeConversationNotificationScope
        ? NotificationSettingsPolicy.resolve(
            notificationSettingsByScopeKey,
            activeConversationNotificationScope,
          )
        : NotificationSettingsPolicy.defaults,
    [activeConversationNotificationScope, notificationSettingsByScopeKey],
  );
  const { activeCommunity, activeCommunityChannelId } = useCommunitySelection({
    activeCommunityId,
    communities,
    communityChannelById,
  });

  if (!initialRenderedCommunityIdRef.current && activeCommunity?.id) {
    initialRenderedCommunityIdRef.current = activeCommunity.id;
  }
  const animateCommunitySidePanelEntries =
    !!activeCommunity?.id &&
    activeCommunity.id !== initialRenderedCommunityIdRef.current;

  useWorkspacePreferences({
    activeCommunityId: activeCommunity?.id ?? activeCommunityId,
    activeConversationId: activeConversation?.id ?? activeConversationId,
    communityChannelById,
    communityUnreadCountsById,
    drafts,
    draftsHydrated,
    identityId: session.identity.id,
    session,
    workspaceMode,
  });

  useEffect(() => {
    if (workspaceMode !== 'community') return;

    void preloadCommunityWorkspace();
  }, [workspaceMode]);

  const visibleCommunityUnreadCountsById = useMemo(
    () =>
      CommunityUnreadState.visibleCounts(
        communityUnreadCountsById,
        notificationSettingsByScopeKey,
      ),
    [communityUnreadCountsById, notificationSettingsByScopeKey],
  );
  const communityUnreadCounts = useMemo(
    () => CommunityUnreadState.totals(visibleCommunityUnreadCountsById),
    [visibleCommunityUnreadCountsById],
  );
  const clearCommunityChannelUnread = useCallback(
    (communityId: string, channelId: string) => {
      setCommunityUnreadCountsById((current) =>
        CommunityUnreadState.withoutChannel(current, communityId, channelId),
      );
    },
    [],
  );
  const markCommunityChannelUnread = useCallback(
    (communityId: string, channelId: string) => {
      setCommunityUnreadCountsById((current) =>
        CommunityUnreadState.withIncrementedChannel(
          current,
          communityId,
          channelId,
        ),
      );
    },
    [],
  );
  const {
    communitySettingFor: communityNotificationSettingFor,
    conversationSettingFor: conversationNotificationSettingFor,
    conversationsWithNotificationState: notificationAwareConversations,
    openCommunitySettings: openCommunityNotificationSettings,
    openConversationSettings: openConversationNotificationSettings,
    toggleCommunityMute: toggleCommunityNotificationMute,
    toggleConversationMute: toggleConversationNotificationMute,
  } = useWorkspaceNotificationActions({
    conversations,
    nodeNetworks,
    openSettings: openNotificationSettings,
    settingsByScopeKey: notificationSettingsByScopeKey,
    toggleMute: toggleNotificationMute,
  });
  const { clearUnreadMessages, conversationsWithUnread, markUnreadMessage } =
    useUnreadMessages(notificationAwareConversations);
  useEffect(() => {
    conversations.forEach((conversation) => {
      const setting = NotificationSettingsPolicy.resolve(
        notificationSettingsByScopeKey,
        {
          conversationId: conversation.id,
          type: 'conversation',
        },
      );

      if (NotificationSettingsPolicy.isMuted(setting)) {
        clearUnreadMessages(conversation.id);
      }
    });
  }, [clearUnreadMessages, conversations, notificationSettingsByScopeKey]);
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
      communities?: Community[];
      communityId?: string;
      conversationId?: string;
      conversations?: ConversationResource[];
      session: Session;
    }) => {
      setSession(next.session);

      if (next.conversations) {
        setConversations(next.conversations);
      }

      if (next.communities) {
        setCommunities(next.communities);
      }

      if (next.conversationId) {
        setActiveConversationId(next.conversationId);
        setWorkspaceMode('messages');
      }

      if (next.communityId) {
        setActiveCommunityId(next.communityId);
        setWorkspaceMode('community');
      }
    },
    [setCommunities, setConversations, setSession],
  );
  const {
    communityAvatarUrls: notificationCommunityAvatarUrls,
    communityPreviews: notificationCommunityPreviews,
    membershipRequests: {
      accept: acceptMembershipRequest,
      action: membershipRequestAction,
      decline: declineMembershipRequest,
      error: membershipRequestError,
      refresh: refreshMembershipRequests,
      requests: membershipRequests,
      setRequests: setMembershipRequests,
    },
    notificationCount: inboxNotificationCount,
    notifications: {
      accept: acceptNotification,
      action: notificationAction,
      archive: archiveNotification,
      decline: declineNotification,
      error: notificationError,
      list: notificationList,
      refresh: refreshNotifications,
      visible: visibleNotifications,
    },
  } = useWorkspaceInbox({
    communities,
    notificationsOpen,
    onAccepted: handleNotificationAccepted,
    onAcceptedPanelClose: closeNotificationsPanel,
    onCommunitiesReload,
    session,
  });

  const logout = () => {
    void deletePwaPushSubscription(session).catch(() => undefined);
    setSession(null);
  };

  usePendingCommunityInvite({
    onPendingCommunityInviteHandled,
    pendingCommunityInvite,
    session,
    setActiveCommunityId,
    setCommunities,
    setSendError,
    setSession,
    setWorkspaceMode,
  });
  const nodeUnclaimed = !node?.owner;
  const activeConversationKey = activeConversation
    ? ConversationKeychain.entry(
        session.keychain,
        session.identity.id,
        activeConversation.id,
      )
    : undefined;
  const activeConversationKeyId = activeConversationKey?.conversationId ?? null;
  const refreshConversations = useCallback(async () => {
    const next = await applicationContainer.conversations.list(session);

    setConversations(next);

    return next;
  }, [session, setConversations]);
  const {
    bottomRef,
    handleScroll,
    isScrolledNearBottom,
    jumpToLatestMessages,
    markConversationReadUntil,
    messageCursor,
    messages,
    messagesRef,
    messageState,
    newMessageCount,
    scrollerRef,
    scrollMessagesToBottom,
    setMessageLoadState,
    setMessages,
    setNewMessageCount,
    updateMessageCursor,
  } = useConversationTimeline({
    activeConversation,
    activeConversationKey,
    clearUnreadMessages,
    onCommunitiesReload,
    onConversationsChange: setConversations,
    onErrorChange: setSendError,
    preloadedConversationMessages,
    refreshConversations,
    sessionRef,
    suppressMessageLoadsUntilRef,
    workspaceMode,
  });
  const {
    cancelEditing: cancelConversationThreadEdit,
    cancelReplying: cancelConversationThreadReply,
    edit: handleEditConversationThreadMessage,
    open: openMessageThread,
    remove: handleDeleteConversationThreadMessage,
    send: sendConversationThreadMessage,
    sendSticker: sendConversationThreadSticker,
    setThread: setConversationThread,
    startEditing: startEditingConversationThreadMessage,
    startReplying: startReplyingToConversationThreadMessage,
    thread: conversationThread,
    updateDraft: updateConversationThreadDraft,
  } = useConversationThread({
    activeConversation,
    closeMessageContextMenu: () => setMessageContextMenu(null),
    session,
    setMessages,
  });
  const {
    collection: messageCollection,
    open: openPinnedMessages,
    pin: pinMessage,
    pinnedMessageIds,
    setCollection: setMessageCollection,
    setPinnedMessageIds,
    unpin: unpinMessage,
    unpinFromCollection: unpinMessageFromDialog,
  } = useConversationPins({
    activeConversation,
    closeMessageContextMenu: () => setMessageContextMenu(null),
    onError: setSendError,
    session,
  });

  useEffect(() => {
    setConversationThread(null);
  }, [activeConversation?.id, setConversationThread]);

  useEffect(() => {
    if (!activeConversation?.id) {
      setPinnedMessageIds(new Set());

      return;
    }

    let cancelled = false;

    const cancelIdleWork = runWhenBrowserIdle(() => {
      void applicationContainer.messages
        .listPins(session, activeConversation.id)
        .then((pins) => {
          if (!cancelled) {
            setPinnedMessageIds(new Set(pins.map((pin) => pin.messageId)));
          }
        })
        .catch(() => {
          if (!cancelled) setPinnedMessageIds(new Set());
        });
    });

    return () => {
      cancelled = true;
      cancelIdleWork();
    };
  }, [activeConversation?.id, session, setPinnedMessageIds]);
  const activeConversationPeerIdentityId = activeConversation
    ? ConversationPeer.identityId(
        activeConversation,
        session.identity.id,
        session.keychain,
      )
    : undefined;
  const messageAuthorIdentityIdsKey = useMemo(
    () => stableUniqueKey(messages.map((message) => message.authorIdentityId)),
    [messages],
  );
  const {
    identityNames,
    identityPictures,
    identityProfiles,
    rememberIdentity,
  } = useIdentityDirectory({
    conversations,
    membershipRequests,
    messageAuthorIdentityIdsKey,
    notifications: notificationList,
    session,
  });
  const closeCommunityMembers = useCallback((): void => {
    closeTransientSurface('community-members');
  }, [closeTransientSurface]);
  const closeCommunityCreation = useCallback((): void => {
    closeTransientSurface('community-creation');
  }, [closeTransientSurface]);
  const closeConversationCreation = useCallback((): void => {
    closeTransientSurface('conversation-creation');
  }, [closeTransientSurface]);
  const closeSidebar = useCallback((): void => {
    closeTransientSurface('sidebar');
  }, [closeTransientSurface]);
  const showMessagesWorkspace = useCallback((): void => {
    setWorkspaceMode('messages');
  }, [setWorkspaceMode]);
  const showCommunityWorkspace = useCallback((): void => {
    setWorkspaceMode('community');
  }, [setWorkspaceMode]);
  const {
    create: createCommunity,
    joinRequested: handleCommunityJoinRequested,
    leave: leaveCommunityFromRail,
    remove: removeCommunity,
    update: updateCommunity,
    updateChannels: updateCommunityChannels,
    updateState: updateCommunityState,
  } = useWorkspaceCommunityActions({
    activeCommunityId,
    closeCommunityCreation,
    closeSidebar,
    session,
    sessionRef,
    setActiveCommunityId,
    setCommunities,
    setMembershipRequests,
    setSendError,
    setSession,
    showCommunityWorkspace,
    showMessagesWorkspace,
  });
  const {
    importConversationKey: handleConversationKeyImported,
    openCreatedConversation: handleConversationCreated,
    openOrCreateConversation: openOrCreateConversationWithIdentity,
  } = useWorkspaceConversationNavigation({
    closeCommunityMembers,
    closeConversationCreation,
    closeSidebar,
    conversations,
    rememberIdentity,
    session,
    sessionRef,
    setActiveConversationId,
    setConversations,
    setSession,
    showMessagesWorkspace,
  });
  const activeConversationInvitation = useMemo(
    () =>
      activeConversation
        ? (notificationList.find((notification) =>
            isPendingConversationInvitationFor(
              notification,
              activeConversation.id,
              session.identity.id,
            ),
          ) ?? null)
        : null,
    [activeConversation, notificationList, session.identity.id],
  );
  const activeConversationInvitationInviterName = activeConversationInvitation
    ? identityPrimaryDisplayName(
        identityDisplayName(
          activeConversationInvitation.payload.inviterIdentityId,
          identityNames,
        ),
      )
    : undefined;
  const activeCommunityInvitation = useMemo(
    () =>
      activeCommunity
        ? (notificationList.find((notification) =>
            isPendingCommunityInvitationFor(
              notification,
              activeCommunity.id,
              session.identity.id,
            ),
          ) ?? null)
        : null,
    [activeCommunity, notificationList, session.identity.id],
  );
  const activeCommunityInvitationInviterName = activeCommunityInvitation
    ? identityPrimaryDisplayName(
        identityDisplayName(
          activeCommunityInvitation.payload.inviterIdentityId,
          identityNames,
        ),
      )
    : undefined;
  const {
    mergePresence,
    notificationsMutedByPresence,
    presenceByIdentityId,
    rememberPresencePreference,
  } = useWorkspacePresence({
    communities,
    conversations,
    messageAuthorIdentityIdsKey,
    session,
  });
  const playNotificationSoundIfAllowed = useCallback(() => {
    if (notificationsMutedByPresence) return;

    playNotificationSound();
  }, [notificationsMutedByPresence]);
  const {
    acceptIncomingCall,
    activeCall,
    declineIncomingCall,
    handleRealtimeCallEvent,
    incomingCall,
    leaveActiveCall,
    retryMicrophone,
    setParticipantScreenShareVolume,
    setParticipantVolume,
    setScreenShareQuality,
    startCommunityVoiceCall,
    startConversationCall,
    toggleCallMediaEncryption,
    toggleCallNoiseCancellation,
    toggleCamera,
    toggleDeafen,
    toggleMute,
    toggleScreenShare,
  } = useWorkspaceCalls({
    activeCommunity,
    communities,
    communityVoiceTopologyKey,
    conversations,
    identityNames,
    identityPictures,
    identityProfiles,
    onCommunitiesChange: setCommunities,
    onCommunitiesReload,
    onErrorChange: setSendError,
    session,
    sessionRef,
  });

  useEffect(() => {
    if (!activeConversationId && conversations[0])
      setActiveConversationId(conversations[0].id);

    if (
      activeConversationId &&
      conversations.length > 0 &&
      !conversations.some(
        (conversation) => conversation.id === activeConversationId,
      )
    ) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  const refreshSession = useCallback(async () => {
    const result = await applicationContainer.session.refresh(session);

    setSession(result.session);
    setConversations(result.conversations);
  }, [session, setConversations, setSession]);

  useEffect(() => {
    if (workspaceMode !== 'messages' || !activeConversation?.id) return;

    setReplyTarget(null);
    setEditingMessage(null);
  }, [activeConversation?.id, workspaceMode]);

  const {
    cancelEdit: cancelMessageEdit,
    cancelReply: cancelMessageReply,
    closeMessageMenu,
    copyMessageContent,
    deleteMessage: handleDeleteMessage,
    editMessage: handleEditMessage,
    openMessageMenu: handleMessageMenuOpen,
    openReplyReference: handleReplyReferenceClick,
    openThreadMessageMenu,
    retryMessage,
    scrollToMessage,
    sendMessage: handleSend,
    sendSticker: handleSendSticker,
    startEditing: startEditingMessage,
    startReplying: startReplyingToMessage,
    toggleReaction: handleToggleMessageReaction,
  } = useConversationMessageActions({
    activeConversation,
    activeConversationDraft,
    activeConversationKeyAvailable: Boolean(activeConversationKey),
    editingMessage,
    messages,
    messagesRef,
    onAttachmentProgressChange: setAttachmentProgress,
    onConversationsChange: setConversations,
    onDraftsChange: setDrafts,
    onEditingMessageChange: setEditingMessage,
    onErrorChange: setSendError,
    onMessageContextMenuChange: setMessageContextMenu,
    onMessageCursorChange: updateMessageCursor,
    onMessageLoadStateChange: setMessageLoadState,
    onMessagesChange: setMessages,
    onReplyTargetChange: setReplyTarget,
    replyTarget,
    scrollerRef,
    scrollToBottom: scrollMessagesToBottom,
    session,
    updateActiveConversationDraft,
  });

  const closeTransientUi = useCallback(() => {
    closeMessageMenu();
    setRawMessage(null);
    cancelMessageReply();
    cancelMessageEdit();
    closeNotificationsPanel();
    closeAllTransientSurfaces();
  }, [
    cancelMessageEdit,
    cancelMessageReply,
    closeAllTransientSurfaces,
    closeMessageMenu,
    closeNotificationsPanel,
  ]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTransientUi();
    };

    window.addEventListener('keydown', handleEscape);

    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeTransientUi]);

  const handleRealtimeCommunityEvent = useWorkspaceRealtimeCommunityEvents({
    onCommunitiesReload,
    refreshMembershipRequests,
    session,
    setCommunities,
    updateCommunityState,
  });
  const handleRealtimeConversationEvent =
    useWorkspaceRealtimeConversationEvents({
      activeConversationId: activeConversation?.id ?? null,
      activeConversationKeyId,
      clearUnreadMessages,
      conversations,
      identityNames,
      identityProfiles,
      isScrolledNearBottom,
      markConversationReadUntil,
      markUnreadMessage,
      messagesRef,
      notificationSettingsRef,
      onErrorChange: setSendError,
      onNotificationSound: playNotificationSoundIfAllowed,
      refreshConversations,
      scrollMessagesToBottom,
      session,
      setConversations,
      setConversationThread,
      setMessages,
      setNewMessageCount,
      setPinnedMessageIds,
      workspaceMode,
    });
  const handleRealtimeEvent = useWorkspaceRealtimeEventRouter({
    activeCommunityChannelId,
    activeCommunityId: activeCommunity?.id ?? null,
    activeCommunityNetworkId: activeCommunity?.networkId ?? null,
    activeConversationNetworkId: activeConversation?.networkId ?? null,
    communities,
    handleCallEvent: handleRealtimeCallEvent,
    handleCommunityDomainEvent: handleRealtimeCommunityEvent,
    handleConversationEvent: handleRealtimeConversationEvent,
    identityNames,
    markCommunityChannelUnread,
    mergePresence,
    notificationSettingsRef,
    onNodeNetworksReload,
    onNotificationSound: playNotificationSoundIfAllowed,
    onPeersReload,
    realtimeEventsOpen,
    refreshNotifications,
    refreshSession,
    rememberIdentity,
    session,
    setActiveCommunityId,
    setActiveConversationId,
    setCommunities,
    setCommunityRealtimeEvent,
    setConversationRealtimeEvent,
    setConversations,
    setMessages,
    setRealtimeEventLog,
    setSession,
    updateMessageCursor,
    workspaceMode,
  });

  const {
    communityTypingIdentityIds,
    conversationTypingIdentityIds,
    receive: handleRealtimeTyping,
    sendCommunityTyping,
    sendConversationTyping,
  } = useWorkspaceTyping({
    activeCommunityChannelId,
    activeCommunityId: activeCommunity?.id ?? null,
    activeConversationId: activeConversation?.id ?? null,
    session,
  });

  useRealtimeEvents(session, {
    onConnected: () => {
      setRealtimeStatus('connected');
    },
    onDisconnected: () => {
      setNetworkSynchronizationStatus(null);
      setRealtimeStatus('reconnecting');
    },
    onDomainEvent: handleRealtimeEvent,
    onNetworkSynchronizationStatus: setNetworkSynchronizationStatus,
    onReconnecting: () => {
      setNetworkSynchronizationStatus(null);
      setRealtimeStatus('reconnecting');
    },
    onTyping: handleRealtimeTyping,
  });
  const handleDialogMessageReply = useCallback(
    (message: ChatMessage): void => {
      if (messageContextMenu?.source === 'thread') {
        startReplyingToConversationThreadMessage(message);

        return;
      }

      startReplyingToMessage(message);
    },
    [
      messageContextMenu?.source,
      startReplyingToConversationThreadMessage,
      startReplyingToMessage,
    ],
  );
  const hasWorkspaceDialogOpen =
    inspectorOpen ||
    isCreateCommunityOpen ||
    isCreateOpen ||
    !!incomingCall ||
    !!messageCollection ||
    !!messageContextMenu ||
    nodeSettingsOpen ||
    !!notificationSettingsTarget ||
    notificationsOpen ||
    !!rawMessage ||
    realtimeEventsOpen;
  const showPushEnablePrompt =
    pushPromptReady && pushPermission === 'default' && !pushPromptDismissed;
  const railProps: RailProps = {
    activeCommunityId:
      workspaceMode === 'community' ? (activeCommunity?.id ?? null) : null,
    activeMessages: workspaceMode === 'messages',
    communities,
    communityNotificationSetting: communityNotificationSettingFor,
    communityUnreadCounts,
    messageNotificationCount: unreadMessageCount,
    notificationCount: inboxNotificationCount,
    onCommunityClick: (communityId) => {
      setActiveCommunityId(communityId);
      setWorkspaceMode('community');
      closeTransientSurface('sidebar');
    },
    onCommunityLeave: leaveCommunityFromRail,
    onCommunityNotificationMuteToggle: toggleCommunityNotificationMute,
    onCommunityNotificationSettingsOpen: openCommunityNotificationSettings,
    onCreateCommunityClick: () => openTransientSurface('community-creation'),
    onMessagesClick: () => {
      setWorkspaceMode('messages');
      closeTransientSurface('sidebar');
    },
    onNotificationsClick: openNotificationsPanel,
    onSettingsClick: openNodeSettings,
    peerCount: peers.length,
    settingsAttention: nodeUnclaimed,
  };

  return (
    <section
      className="relative z-10 min-h-full overflow-hidden overscroll-none"
      onPointerCancel={clearSidebarGesture}
      onPointerDown={handleWorkspacePointerDown}
      onPointerMove={handleWorkspacePointerMove}
      onPointerUp={clearSidebarGesture}
    >
      <div className="app-workspace grid w-full grid-cols-1 gap-0 px-0 pb-0 lg:grid-cols-[82px_330px_minmax(0,1fr)] xl:grid-cols-[82px_330px_minmax(0,1fr)_320px]">
        <Rail {...railProps} className="hidden lg:flex" />

        {workspaceMode === 'messages' ? (
          <>
            <div
              className={cx(
                'app-safe-area-drawer-until-lg app-safe-area-drawer-flush fixed inset-y-0 left-0 z-40 block w-[92vw] max-w-[430px] p-0 transition-transform duration-200 ease-out sm:w-[calc(86vw+82px)] sm:max-w-[442px] lg:static lg:block lg:w-auto lg:max-w-none lg:translate-x-0',
                sidebarOpen
                  ? 'translate-x-0'
                  : 'pointer-events-none -translate-x-full lg:pointer-events-auto',
              )}
            >
              <div className="grid h-full grid-cols-[82px_minmax(0,1fr)] gap-0 lg:block">
                <Rail
                  {...railProps}
                  className="lg:hidden"
                  onInspectorClick={() => openTransientSurface('inspector')}
                />
                <Suspense fallback={<SidebarStartupFallback />}>
                  <Sidebar
                    activeCall={activeCall}
                    animationScopeKey={sidebarOpen ? 'open' : 'closed'}
                    communities={communities}
                    session={session}
                    conversations={conversationsWithUnread}
                    conversationNotificationSetting={
                      conversationNotificationSettingFor
                    }
                    identityNames={identityNames}
                    identityPictures={identityPictures}
                    identityProfiles={identityProfiles}
                    presenceByIdentityId={presenceByIdentityId}
                    nodeNetworks={nodeNetworks}
                    activeConversationId={activeConversation?.id ?? null}
                    onSelect={(id) => {
                      clearUnreadMessages(id);
                      setNewMessageCount(0);
                      setActiveConversationId(id);
                      closeTransientSurface('sidebar');
                    }}
                    onConversationNotificationMuteToggle={
                      toggleConversationNotificationMute
                    }
                    onConversationNotificationSettingsOpen={
                      openConversationNotificationSettings
                    }
                    onCreate={() =>
                      openTransientSurface('conversation-creation')
                    }
                    onCallEnd={leaveActiveCall}
                    onCallParticipantVolumeChange={setParticipantVolume}
                    onCallParticipantScreenShareVolumeChange={
                      setParticipantScreenShareVolume
                    }
                    onCallScreenShareQualityChange={setScreenShareQuality}
                    onCallToggleCamera={toggleCamera}
                    onCallToggleDeafen={toggleDeafen}
                    onCallToggleMediaEncryption={toggleCallMediaEncryption}
                    onCallToggleMute={toggleMute}
                    onCallToggleNoiseCancellation={toggleCallNoiseCancellation}
                    onCallRetryMicrophone={retryMicrophone}
                    onCallToggleScreenShare={toggleScreenShare}
                    onLogout={logout}
                    onSessionUpdated={(nextSession) => {
                      setSession(nextSession);
                      rememberIdentity(nextSession.identity);
                    }}
                    onPresenceChange={mergePresence}
                    onPresenceStatusSelected={rememberPresencePreference}
                  />
                </Suspense>
              </div>
            </div>

            <button
              className={cx(
                'fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 lg:hidden',
                sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
              onClick={() => closeTransientSurface('sidebar')}
              aria-label={copy.workspace.closeSidebar}
            />

            {conversationThread && activeConversation ? (
              <MessageThreadPanel
                attachmentEncryptionAvailable={Boolean(activeConversationKey)}
                currentIdentityId={session.identity.id}
                disabled={!activeConversationKey}
                draft={conversationThread.draft}
                editingMessage={
                  conversationThread.editingMessage?.message ?? null
                }
                error={conversationThread.error}
                identityNames={identityNames}
                identityPictures={identityPictures}
                messages={conversationThread.messages}
                onCancelEdit={cancelConversationThreadEdit}
                onCancelReply={cancelConversationThreadReply}
                onClose={() => setConversationThread(null)}
                onDraftChange={updateConversationThreadDraft}
                onEdit={handleEditConversationThreadMessage}
                onMessageMenuOpen={openThreadMessageMenu}
                onRootMessageOpen={(message) => {
                  setMessages((current) =>
                    MessageCollection.merge(current, [message]),
                  );
                  setConversationThread(null);
                  window.setTimeout(() => scrollToMessage(message.id), 0);
                }}
                onSend={sendConversationThreadMessage}
                onStickerSend={sendConversationThreadSticker}
                pinnedMessageIds={pinnedMessageIds}
                replyTo={conversationThread.replyTarget}
                replyToAuthorName={
                  conversationThread.replyTarget
                    ? identityDisplayName(
                        conversationThread.replyTarget.authorIdentityId,
                        identityNames,
                      )
                    : undefined
                }
                rootMessage={conversationThread.root}
                session={session}
                title={
                  activeConversation.title ??
                  activeConversation.name ??
                  (activeConversationPeerIdentityId
                    ? identityNames[activeConversationPeerIdentityId]
                    : undefined) ??
                  activeConversation.id
                }
              />
            ) : (
              <Suspense fallback={null}>
                <ChatColumn
                  session={session}
                  activeConversation={activeConversation}
                  conversationKey={activeConversationKey}
                  draft={activeConversationDraft}
                  editingMessage={editingMessage?.message ?? null}
                  groupInviteRequest={groupInviteRequest}
                  hasConversationKey={!!activeConversationKey}
                  hasReachedMessageStart={!messageCursor}
                  invitationAccepting={notificationAction === 'accept'}
                  invitationError={notificationError}
                  invitationInviterName={
                    activeConversationInvitationInviterName
                  }
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
                  presenceByIdentityId={presenceByIdentityId}
                  messages={messages}
                  messageState={messageState}
                  newMessageCount={newMessageCount}
                  nodeNetworks={nodeNetworks}
                  notificationSetting={activeConversationNotificationSetting}
                  pinnedMessageIds={pinnedMessageIds}
                  sendError={sendError}
                  scrollerRef={scrollerRef}
                  bottomRef={bottomRef}
                  onScroll={handleScroll}
                  onCancelEdit={cancelMessageEdit}
                  onEditMessage={handleEditMessage}
                  onSend={handleSend}
                  onStickerSend={handleSendSticker}
                  onConversationKeyImported={handleConversationKeyImported}
                  onInvitationAccept={(notification) =>
                    void acceptNotification(notification)
                  }
                  onDraftChange={updateActiveConversationDraft}
                  onEscape={closeTransientUi}
                  onJumpToLatest={jumpToLatestMessages}
                  onMessageMenuOpen={handleMessageMenuOpen}
                  onOpenMessageThread={(message) =>
                    void openMessageThread(message)
                  }
                  onReactionToggle={(message, emoji, reacted) =>
                    void handleToggleMessageReaction(message, emoji, reacted)
                  }
                  onReplyReferenceClick={(messageId) =>
                    void handleReplyReferenceClick(messageId)
                  }
                  onOpenPins={() => void openPinnedMessages()}
                  onOpenSidebar={() => openTransientSurface('sidebar')}
                  onNotificationMuteToggle={toggleNotificationMute}
                  onNotificationSettingsOpen={openNotificationSettings}
                  onCreate={() => openTransientSurface('conversation-creation')}
                  onOpenConversationWithIdentity={(identityId, identity) =>
                    openOrCreateConversationWithIdentity(
                      identityId,
                      identity,
                      activeConversation?.networkId,
                    )
                  }
                  progress={attachmentProgress}
                  realtimeStatus={realtimeStatus}
                  realtimeEvent={conversationRealtimeEvent}
                  onRealtimeEventsOpen={openRealtimeEvents}
                  replyToMessage={replyTarget}
                  onCancelReply={cancelMessageReply}
                  onRetryMessage={retryMessage}
                  onStartCall={startConversationCall}
                  onTypingActive={sendConversationTyping}
                  pendingInvitation={activeConversationInvitation}
                  typingIdentityIds={conversationTypingIdentityIds}
                />
              </Suspense>
            )}

            <Suspense fallback={<InspectorStartupFallback />}>
              <Inspector
                className="hidden xl:block"
                session={session}
                activeConversation={activeConversation}
                activeConversationPeerIdentityId={
                  activeConversationPeerIdentityId
                }
                identityNames={identityNames}
                identityPictures={identityPictures}
                identityProfiles={identityProfiles}
                nodeNetworks={nodeNetworks}
                onGroupInviteOpen={() =>
                  setGroupInviteRequest((request) => request + 1)
                }
                onOpenConversationWithIdentity={
                  openOrCreateConversationWithIdentity
                }
                presenceByIdentityId={presenceByIdentityId}
              />
            </Suspense>
          </>
        ) : communitiesLoading && !activeCommunity ? (
          <CommunityWorkspaceStartupFallback />
        ) : activeCommunity ? (
          <Suspense fallback={<CommunityWorkspaceStartupFallback />}>
            <CommunityWorkspace
              key={activeCommunity.id}
              activeChannelId={activeCommunityChannelId}
              animateSidePanelEntries={animateCommunitySidePanelEntries}
              channelUnreadCounts={
                visibleCommunityUnreadCountsById[activeCommunity.id] ?? {}
              }
              community={activeCommunity}
              invitationAccepting={notificationAction === 'accept'}
              invitationError={notificationError}
              invitationInviterName={activeCommunityInvitationInviterName}
              timelineFocusKey={`${workspaceMode}:${activeCommunity.id}:${
                activeCommunityChannelId ?? ''
              }`}
              notificationSettingsByScopeKey={notificationSettingsByScopeKey}
              mobileMembersOpen={communityMembersOpen}
              mobileSidebarOpen={sidebarOpen}
              mobileRail={
                <Rail
                  {...railProps}
                  onInspectorClick={() => {
                    closeTransientSurface('sidebar');
                    openTransientSurface('community-members');
                  }}
                />
              }
              nodeNetworks={nodeNetworks}
              activeCall={activeCall}
              onCallEnd={leaveActiveCall}
              onCallParticipantVolumeChange={setParticipantVolume}
              onCallParticipantScreenShareVolumeChange={
                setParticipantScreenShareVolume
              }
              onCallScreenShareQualityChange={setScreenShareQuality}
              onCallToggleCamera={toggleCamera}
              onCallToggleDeafen={toggleDeafen}
              onCallToggleMediaEncryption={toggleCallMediaEncryption}
              onCallToggleMute={toggleMute}
              onCallToggleNoiseCancellation={toggleCallNoiseCancellation}
              onCallRetryMicrophone={retryMicrophone}
              onCallToggleScreenShare={toggleScreenShare}
              realtimeEvent={communityRealtimeEvent}
              presenceByIdentityId={presenceByIdentityId}
              onChannelSelected={(channelId) =>
                setCommunityChannelById((current) =>
                  current[activeCommunity.id] === channelId
                    ? current
                    : {
                        ...current,
                        [activeCommunity.id]: channelId,
                      },
                )
              }
              onCommunityUpdated={updateCommunity}
              onCommunityChannelsUpdated={updateCommunityChannels}
              onInvitationAccept={(notification) =>
                void acceptNotification(notification)
              }
              onCommunityLeft={removeCommunity}
              onChannelViewed={(channelId) =>
                clearCommunityChannelUnread(activeCommunity.id, channelId)
              }
              onLogout={logout}
              onMobileSidebarClose={() => closeTransientSurface('sidebar')}
              onMobileMembersClose={() =>
                closeTransientSurface('community-members')
              }
              onNotificationMuteToggle={toggleNotificationMute}
              onNotificationSettingsOpen={openNotificationSettings}
              onOpenMobileSidebar={() => openTransientSurface('sidebar')}
              onOpenConversationWithIdentity={(identityId, identity) =>
                openOrCreateConversationWithIdentity(
                  identityId,
                  identity,
                  activeCommunity.networkId,
                )
              }
              onSessionUpdated={(nextSession) => {
                setSession(nextSession);
                rememberIdentity(nextSession.identity);
              }}
              onPresenceChange={mergePresence}
              onPresenceStatusSelected={rememberPresencePreference}
              onTypingActive={sendCommunityTyping}
              realtimeStatus={realtimeStatus}
              onRealtimeEventsOpen={openRealtimeEvents}
              pendingInvitation={activeCommunityInvitation}
              session={session}
              typingIdentityIds={communityTypingIdentityIds}
              onJoinVoiceChannel={startCommunityVoiceCall}
            />
          </Suspense>
        ) : (
          <div className="glass-panel-strong col-span-3 flex h-full flex-col justify-center rounded-none p-4 text-center text-sm text-white/55">
            {communitiesError?.message ?? copy.communities.empty}
          </div>
        )}
      </div>

      {showPushEnablePrompt && !hasWorkspaceDialogOpen ? (
        <PushNotificationPrompt
          enableState={pushEnableState}
          error={pushEnableError}
          onDismiss={dismissPushPrompt}
          onEnable={() => void enablePushNotifications()}
        />
      ) : null}

      {messageCollection ? (
        <MessageCollectionDialog
          actions={[
            {
              label: copy.messages.unpin,
              onClick: (message) => void unpinMessageFromDialog(message),
              tone: 'danger',
            },
          ]}
          description={copy.messages.pinnedMessagesBody}
          emptyLabel={
            messageCollection.state === 'loading'
              ? copy.app.loading
              : (messageCollection.error ?? copy.messages.emptyPins)
          }
          identityNames={identityNames}
          identityPictures={identityPictures}
          messages={messageCollection.messages}
          onClose={() => setMessageCollection(null)}
          onMessageOpen={(message) => {
            setMessageCollection(null);
            void handleReplyReferenceClick(message.id);
          }}
          subtitle={messageCollection.error}
          title={copy.messages.pinnedMessages}
        />
      ) : null}

      {hasWorkspaceDialogOpen ? (
        <Suspense fallback={null}>
          <WorkspaceDialogs
            creation={{
              conversations,
              createCommunityOpen: isCreateCommunityOpen,
              createConversationOpen: isCreateOpen,
              nodeNetworks,
              onCloseCommunity: () =>
                closeTransientSurface('community-creation'),
              onCloseConversation: () =>
                closeTransientSurface('conversation-creation'),
              onCommunityCreated: createCommunity,
              onCommunityJoinRequested: handleCommunityJoinRequested,
              onConversationCreated: handleConversationCreated,
              session,
            }}
            incomingCall={{
              incomingCall,
              onAccept: acceptIncomingCall,
              onDecline: declineIncomingCall,
            }}
            inspector={{
              activeConversation,
              activeConversationPeerIdentityId,
              identityNames,
              identityPictures,
              identityProfiles,
              nodeNetworks,
              onClose: () => closeTransientSurface('inspector'),
              onGroupInviteOpen: () =>
                setGroupInviteRequest((request) => request + 1),
              onOpenConversationWithIdentity:
                openOrCreateConversationWithIdentity,
              open: inspectorOpen,
              presenceByIdentityId,
              session,
            }}
            messageActions={{
              activeConversation,
              menu: messageContextMenu,
              onCloseMenu: closeMessageMenu,
              onCloseRawMessage: () => setRawMessage(null),
              onCopy: copyMessageContent,
              onDelete: (message) =>
                void (messageContextMenu?.source === 'thread'
                  ? handleDeleteConversationThreadMessage(message)
                  : handleDeleteMessage(message)),
              onDownloadAttachment: (attachment) =>
                void downloadContextAttachment(attachment),
              onEdit: (message) =>
                messageContextMenu?.source === 'thread'
                  ? startEditingConversationThreadMessage(message)
                  : startEditingMessage(message),
              onOpenThread: (message) => void openMessageThread(message),
              onPin: (message) => void pinMessage(message),
              onReply: handleDialogMessageReply,
              onToggleReaction: (message, emoji, reacted) =>
                void handleToggleMessageReaction(message, emoji, reacted),
              onUnpin: (message) => void unpinMessage(message),
              onViewRaw: (message) => {
                setRawMessage(message);
                closeMessageMenu();
              },
              pinnedMessageIds,
              rawMessage,
              session,
            }}
            nodeSettings={{
              networkSynchronizationStatus,
              networks: nodeNetworks,
              node,
              onClose: () => closeTransientSurface('node-settings'),
              onNetworksUpdated: onNodeNetworksReload,
              open: nodeSettingsOpen,
              peers,
              peersLoading,
              session,
            }}
            notificationSettings={{
              error: notificationSettingsError,
              onClose: closeNotificationSettings,
              onReset: resetNotificationSetting,
              onSave: saveNotificationSetting,
              setting: notificationSettingsSetting,
              target: notificationSettingsTarget,
            }}
            notifications={{
              action: notificationAction,
              archive: archiveNotification,
              communities,
              communityAvatarUrls: notificationCommunityAvatarUrls,
              communityPreviews: notificationCommunityPreviews,
              conversations,
              error: notificationError,
              identityNames,
              identityPictures,
              identityProfiles,
              membershipAction: membershipRequestAction,
              membershipError: membershipRequestError,
              membershipRequests,
              nodeNetworks,
              notifications: visibleNotifications,
              onAccept: (notification) => void acceptNotification(notification),
              onAcceptMembershipRequest: (requestId) =>
                void acceptMembershipRequest(requestId),
              onClose: closeNotificationsPanel,
              onDecline: (notificationId) =>
                void declineNotification(notificationId),
              onDeclineMembershipRequest: (requestId) =>
                void declineMembershipRequest(requestId),
              open: notificationsOpen,
              session,
            }}
            realtimeEvents={{
              events: realtimeEventLog,
              onClose: () => closeTransientSurface('realtime-events'),
              open: realtimeEventsOpen,
            }}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
