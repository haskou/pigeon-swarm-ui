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
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { PreloadedConversationMessages } from '../PreloadedConversationMessages';
import type { MessageContextMenuState } from './messageContextMenu';

import { useRealtimeEvents } from '../../../../app/presentation/realtime/useRealtimeEvents';
import { useAttachmentDownload } from '../../../../contexts/attachments/presentation/hooks/useAttachmentDownload';
import { useIdentityDirectory } from '../../../../contexts/identities/presentation/hooks/useIdentityDirectory';
import { MessageCollectionDialog } from '../../../../contexts/messages/presentation/components/MessageCollectionDialog';
import { useUnreadMessages } from '../../../../contexts/messages/presentation/hooks/useUnreadMessages';
import { useNotificationScopeSettings } from '../../../../contexts/notifications/presentation/hooks/useNotificationScopeSettings';
import { usePushNotificationRegistration } from '../../../../contexts/notifications/presentation/hooks/usePushNotificationRegistration';
import { deletePwaPushSubscription } from '../../../../contexts/notifications/presentation/services/pwaNotifications';
import { NotificationSettingsPolicy } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { playNotificationSound } from '../../../../shared/presentation/sounds';
import { applicationContainer } from '../../../composition/applicationContainer';
import {
  useWorkspacePreferences,
  useWorkspacePreferenceState,
} from '../useWorkspacePreferences';
import { CommunityUnreadState } from './CommunityUnreadState';
import { communityVoiceChannelTopologyKey } from './communityVoicePresence';
import { CommunityWorkspaceContent } from './CommunityWorkspaceContent';
import { type EditingMessage } from './conversationThreadState';
import { MessagesWorkspaceContent } from './MessagesWorkspaceContent';
import { PushNotificationPrompt } from './PushNotificationPrompt';
import { Rail, type RailProps } from './Rail';
import { useCommunityPanelAnimation } from './useCommunityPanelAnimation';
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
import { WorkspaceDerivedState } from './WorkspaceDerivedState';
import {
  preloadCommunityWorkspace,
  WorkspaceDialogs,
} from './workspaceLazyComponents';
import { stableUniqueKey } from './workspaceNotificationState';

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

  const activeConversation = WorkspaceDerivedState.activeConversation(
    conversations,
    activeConversationId,
  );
  const {
    activeDraft: activeConversationDraft,
    updateActiveDraft: updateActiveConversationDraft,
  } = useConversationDrafts({
    activeConversationId: WorkspaceDerivedState.id(activeConversation),
    drafts,
    onDraftsChange: setDrafts,
    session,
  });
  const activeConversationNotificationScope =
    WorkspaceDerivedState.conversationNotificationScope(activeConversation);
  const activeConversationNotificationSetting =
    WorkspaceDerivedState.conversationNotificationSetting(
      notificationSettingsByScopeKey,
      activeConversationNotificationScope,
    );
  const { activeCommunity, activeCommunityChannelId } = useCommunitySelection({
    activeCommunityId,
    communities,
    communityChannelById,
  });

  const animateCommunitySidePanelEntries = useCommunityPanelAnimation(
    WorkspaceDerivedState.id(activeCommunity),
  );

  useWorkspacePreferences({
    activeCommunityId: WorkspaceDerivedState.selectedId(
      activeCommunity,
      activeCommunityId,
    ),
    activeConversationId: WorkspaceDerivedState.selectedId(
      activeConversation,
      activeConversationId,
    ),
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
  const nodeUnclaimed = WorkspaceDerivedState.nodeIsUnclaimed(node);
  const activeConversationKey = WorkspaceDerivedState.conversationKey(
    session,
    activeConversation,
  );
  const activeConversationKeyId = WorkspaceDerivedState.conversationKeyId(
    activeConversationKey,
  );
  const refreshConversations = useCallback(async () => {
    const next = await applicationContainer.conversations.list(session);

    setConversations(next);

    return next;
  }, [session, setConversations]);
  const timeline = useConversationTimeline({
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
    isScrolledNearBottom,
    markConversationReadUntil,
    messages,
    messagesRef,
    scrollerRef,
    scrollMessagesToBottom,
    setMessageLoadState,
    setMessages,
    setNewMessageCount,
    updateMessageCursor,
  } = timeline;
  const conversationThreadController = useConversationThread({
    activeConversation,
    closeMessageContextMenu: () => setMessageContextMenu(null),
    session,
    setMessages,
  });
  const {
    open: openMessageThread,
    remove: handleDeleteConversationThreadMessage,
    setThread: setConversationThread,
    startEditing: startEditingConversationThreadMessage,
    startReplying: startReplyingToConversationThreadMessage,
  } = conversationThreadController;
  const conversationPins = useConversationPins({
    activeConversation,
    closeMessageContextMenu: () => setMessageContextMenu(null),
    onError: setSendError,
    session,
  });
  const {
    collection: messageCollection,
    pin: pinMessage,
    pinnedMessageIds,
    setCollection: setMessageCollection,
    setPinnedMessageIds,
    unpin: unpinMessage,
    unpinFromCollection: unpinMessageFromDialog,
  } = conversationPins;

  useEffect(() => {
    setConversationThread(null);
  }, [activeConversation?.id, setConversationThread]);

  const activeConversationPeerIdentityId =
    WorkspaceDerivedState.conversationPeerIdentityId(
      activeConversation,
      session,
    );
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
  const activeConversationInvitation =
    WorkspaceDerivedState.pendingConversationInvitation(
      notificationList,
      activeConversation,
      session.identity.id,
    );
  const activeConversationInvitationInviterName =
    WorkspaceDerivedState.invitationInviterName(
      activeConversationInvitation,
      identityNames,
    );
  const activeCommunityInvitation =
    WorkspaceDerivedState.pendingCommunityInvitation(
      notificationList,
      activeCommunity,
      session.identity.id,
    );
  const activeCommunityInvitationInviterName =
    WorkspaceDerivedState.invitationInviterName(
      activeCommunityInvitation,
      identityNames,
    );
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
  const callControls = useWorkspaceCalls({
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
  const {
    acceptIncomingCall,
    declineIncomingCall,
    handleRealtimeCallEvent,
    incomingCall,
  } = callControls;

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

  const messageActions = useConversationMessageActions({
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
  const {
    cancelEdit: cancelMessageEdit,
    cancelReply: cancelMessageReply,
    closeMessageMenu,
    copyMessageContent,
    deleteMessage: handleDeleteMessage,
    openReplyReference: handleReplyReferenceClick,
    startEditing: startEditingMessage,
    startReplying: startReplyingToMessage,
    toggleReaction: handleToggleMessageReaction,
  } = messageActions;

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
      activeConversationId: WorkspaceDerivedState.id(activeConversation),
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
    activeCommunityId: WorkspaceDerivedState.id(activeCommunity),
    activeCommunityNetworkId: WorkspaceDerivedState.networkId(activeCommunity),
    activeConversationNetworkId:
      WorkspaceDerivedState.networkId(activeConversation),
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
    activeCommunityId: WorkspaceDerivedState.id(activeCommunity),
    activeConversationId: WorkspaceDerivedState.id(activeConversation),
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
  const hasWorkspaceDialogOpen = WorkspaceDerivedState.hasOpenDialog([
    inspectorOpen,
    isCreateCommunityOpen,
    isCreateOpen,
    Boolean(incomingCall),
    Boolean(messageCollection),
    Boolean(messageContextMenu),
    nodeSettingsOpen,
    Boolean(notificationSettingsTarget),
    notificationsOpen,
    Boolean(rawMessage),
    realtimeEventsOpen,
  ]);
  const showPushEnablePrompt = WorkspaceDerivedState.pushPromptVisible(
    pushPromptReady,
    pushPermission,
    pushPromptDismissed,
  );
  const activeCommunityUnreadCounts =
    WorkspaceDerivedState.communityChannelUnreadCounts(
      activeCommunity,
      visibleCommunityUnreadCountsById,
    );
  const railProps: RailProps = {
    activeCommunityId: WorkspaceDerivedState.railCommunityId(
      workspaceMode,
      activeCommunity,
    ),
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
            <MessagesWorkspaceContent
              acceptInvitation={(notification) =>
                void acceptNotification(notification)
              }
              activeConversation={activeConversation}
              activeConversationDraft={activeConversationDraft}
              activeConversationKey={activeConversationKey}
              activeConversationPeerIdentityId={
                activeConversationPeerIdentityId
              }
              attachmentProgress={attachmentProgress}
              callControls={callControls}
              closeTransientUi={closeTransientUi}
              communities={communities}
              conversationNotificationSetting={
                activeConversationNotificationSetting
              }
              conversationNotificationSettingFor={
                conversationNotificationSettingFor
              }
              conversationRealtimeEvent={conversationRealtimeEvent}
              conversationTypingIdentityIds={conversationTypingIdentityIds}
              conversationsWithUnread={conversationsWithUnread}
              editingMessage={editingMessage}
              groupInviteRequest={groupInviteRequest}
              identityNames={identityNames}
              identityPictures={identityPictures}
              identityProfiles={identityProfiles}
              invitationAccepting={notificationAction === 'accept'}
              invitationError={notificationError}
              invitationInviterName={activeConversationInvitationInviterName}
              messageActions={messageActions}
              nodeNetworks={nodeNetworks}
              notificationMuteToggle={toggleNotificationMute}
              notificationSettingsOpen={openNotificationSettings}
              onConversationKeyImported={handleConversationKeyImported}
              onConversationNotificationMuteToggle={
                toggleConversationNotificationMute
              }
              onConversationNotificationSettingsOpen={
                openConversationNotificationSettings
              }
              onConversationSelected={(conversationId) => {
                clearUnreadMessages(conversationId);
                setNewMessageCount(0);
                setActiveConversationId(conversationId);
              }}
              onCreateConversation={() =>
                openTransientSurface('conversation-creation')
              }
              onGroupInviteOpen={() =>
                setGroupInviteRequest((request) => request + 1)
              }
              onInspectorOpen={() => openTransientSurface('inspector')}
              onLogout={logout}
              onOpenConversationWithIdentity={
                openOrCreateConversationWithIdentity
              }
              onPresenceChange={mergePresence}
              onPresenceStatusSelected={rememberPresencePreference}
              onRealtimeEventsOpen={openRealtimeEvents}
              onSessionUpdated={(nextSession) => {
                setSession(nextSession);
                rememberIdentity(nextSession.identity);
              }}
              onSidebarClose={() => closeTransientSurface('sidebar')}
              onSidebarOpen={() => openTransientSurface('sidebar')}
              pendingInvitation={activeConversationInvitation}
              pins={conversationPins}
              presenceByIdentityId={presenceByIdentityId}
              railProps={railProps}
              realtimeStatus={realtimeStatus}
              replyTarget={replyTarget}
              sendConversationTyping={sendConversationTyping}
              sendError={sendError}
              session={session}
              sidebarOpen={sidebarOpen}
              thread={conversationThreadController}
              timeline={timeline}
              updateActiveDraft={updateActiveConversationDraft}
            />
          </>
        ) : (
          <CommunityWorkspaceContent
            activeChannelId={activeCommunityChannelId}
            activeCommunity={activeCommunity}
            animateSidePanelEntries={animateCommunitySidePanelEntries}
            callControls={callControls}
            channelUnreadCounts={activeCommunityUnreadCounts}
            communityRealtimeEvent={communityRealtimeEvent}
            communityTypingIdentityIds={communityTypingIdentityIds}
            error={communitiesError}
            invitationAccepting={notificationAction === 'accept'}
            invitationError={notificationError}
            invitationInviterName={activeCommunityInvitationInviterName}
            loading={communitiesLoading}
            membersOpen={communityMembersOpen}
            nodeNetworks={nodeNetworks}
            notificationSettingsByScopeKey={notificationSettingsByScopeKey}
            onChannelSelected={(communityId, channelId) =>
              setCommunityChannelById((current) =>
                current[communityId] === channelId
                  ? current
                  : { ...current, [communityId]: channelId },
              )
            }
            onChannelViewed={clearCommunityChannelUnread}
            onCommunityChannelsUpdated={updateCommunityChannels}
            onCommunityLeft={removeCommunity}
            onCommunityUpdated={updateCommunity}
            onInvitationAccept={(notification) =>
              void acceptNotification(notification)
            }
            onLogout={logout}
            onMembersClose={() => closeTransientSurface('community-members')}
            onMembersOpen={() => openTransientSurface('community-members')}
            onNotificationMuteToggle={toggleNotificationMute}
            onNotificationSettingsOpen={openNotificationSettings}
            onOpenConversationWithIdentity={
              openOrCreateConversationWithIdentity
            }
            onPresenceChange={mergePresence}
            onPresenceStatusSelected={rememberPresencePreference}
            onRealtimeEventsOpen={openRealtimeEvents}
            onSessionUpdated={(nextSession) => {
              setSession(nextSession);
              rememberIdentity(nextSession.identity);
            }}
            onSidebarClose={() => closeTransientSurface('sidebar')}
            onSidebarOpen={() => openTransientSurface('sidebar')}
            pendingInvitation={activeCommunityInvitation}
            presenceByIdentityId={presenceByIdentityId}
            railProps={railProps}
            realtimeStatus={realtimeStatus}
            sendCommunityTyping={sendCommunityTyping}
            session={session}
            sidebarOpen={sidebarOpen}
          />
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
              networks: nodeNetworks,
              networkSynchronizationStatus,
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
