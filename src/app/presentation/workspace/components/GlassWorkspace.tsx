import {
  type Dispatch,
  type SetStateAction,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { CallParticipantMediaConnectionResource as CallParticipantMediaConnection } from '../../../../contexts/calls/infrastructure/http/resources/CallParticipantMediaConnectionResource';
import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSignalType } from '../../../../contexts/calls/infrastructure/media/CallSignalType';
import type { CallMediaEncryptionUnavailableReason } from '../../../../contexts/calls/presentation/view-models/CallMediaEncryptionUnavailableReason';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';
import type { PendingCommunityInviteLink } from '../../../../contexts/communities/presentation/view-models/communityInviteLink';
import type { NodeInfo } from '../../../../contexts/networks/infrastructure/http/NodeInfo';
import type { NetworkSynchronizationStatus } from '../../../../contexts/networks/presentation/view-models/NetworkSynchronizationStatus';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type { Peer } from '../../../../contexts/networks/presentation/view-models/Peer';
import type {
  ChatMessage,
  AttachmentProgress,
  Community,
  CommunityChannel,
  CommunityMembershipRequest,
  ConversationKeyEntry,
  ConversationResource,
  IdentityResource,
  NotificationSettingScope,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { PreloadedConversationMessages } from '../PreloadedConversationMessages';
import type { MessageContextMenuState } from './messageContextMenu';

import { useRealtimeEvents } from '../../../../app/presentation/realtime/useRealtimeEvents';
import { useAttachmentDownload } from '../../../../contexts/attachments/presentation/hooks/useAttachmentDownload';
import {
  logCallDebug,
  logCallError,
} from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { useCallMediaAccess } from '../../../../contexts/calls/presentation/hooks/useCallMediaAccess';
import { useCallSession } from '../../../../contexts/calls/presentation/hooks/useCallSession';
import { SeenCommunityMembershipRequests } from '../../../../contexts/communities/infrastructure/storage/SeenCommunityMembershipRequests';
import { useCommunityMembershipRequests } from '../../../../contexts/communities/presentation/hooks/useCommunityMembershipRequests';
import { CommunityChannels } from '../../../../contexts/communities/presentation/view-models/CommunityChannels';
import { CommunityList } from '../../../../contexts/communities/presentation/view-models/CommunityList';
import { ConversationPeer } from '../../../../contexts/conversations/presentation/view-models/ConversationPeer';
import { ConversationTimeline } from '../../../../contexts/conversations/presentation/view-models/ConversationTimeline';
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
import { MessageReactionUpdater } from '../../../../contexts/messages/presentation/view-models/MessageReactionUpdater';
import { SharedNetworkSelectorDomainService } from '../../../../contexts/networks/domain/services/SharedNetworkSelectorDomainService';
import { NetworkId } from '../../../../contexts/networks/domain/value-objects/NetworkId';
import { useNotificationCommunityPreviews } from '../../../../contexts/notifications/presentation/hooks/useNotificationCommunityPreviews';
import { useNotifications } from '../../../../contexts/notifications/presentation/hooks/useNotifications';
import { useNotificationScopeSettings } from '../../../../contexts/notifications/presentation/hooks/useNotificationScopeSettings';
import { usePushNotificationRegistration } from '../../../../contexts/notifications/presentation/hooks/usePushNotificationRegistration';
import { deletePwaPushSubscription } from '../../../../contexts/notifications/presentation/services/pwaNotifications';
import { NotificationSettingsPolicy } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';
import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { runWhenBrowserIdle } from '../../../../shared/presentation/runWhenBrowserIdle';
import { playNotificationSound } from '../../../../shared/presentation/sounds';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import {
  useWorkspacePreferences,
  useWorkspacePreferenceState,
} from '../useWorkspacePreferences';
import { ChatColumn } from './ChatColumn';
import {
  communitiesWithCallVoicePresence,
  communityVoiceChannelTopologyKey,
} from './communityVoicePresence';
import { CommunityWorkspaceStartupFallback } from './CommunityWorkspaceStartupFallback';
import { type EditingMessage } from './conversationThreadState';
import { PushNotificationPrompt } from './PushNotificationPrompt';
import { Rail } from './Rail';
import { resolveWorkspaceCallDetails } from './resolveWorkspaceCallDetails';
import { useCallDeparture } from './useCallDeparture';
import { useCallResourceReconciliation } from './useCallResourceReconciliation';
import { useCallStartActions } from './useCallStartActions';
import { useCommunitySelection } from './useCommunitySelection';
import { useConversationMessageDelivery } from './useConversationMessageDelivery';
import { useConversationPins } from './useConversationPins';
import { useConversationThread } from './useConversationThread';
import { useMessageViewport } from './useMessageViewport';
import { usePendingCommunityInvite } from './usePendingCommunityInvite';
import { useSidebarGesture } from './useSidebarGesture';
import { useWorkspaceCallHeartbeat } from './useWorkspaceCallHeartbeat';
import { useWorkspaceMessageHistory } from './useWorkspaceMessageHistory';
import { useWorkspaceNotificationActions } from './useWorkspaceNotificationActions';
import { useWorkspacePresence } from './useWorkspacePresence';
import { useWorkspaceRealtimeCallEvents } from './useWorkspaceRealtimeCallEvents';
import { useWorkspaceRealtimeCommunityEvents } from './useWorkspaceRealtimeCommunityEvents';
import { useWorkspaceRealtimeConversationEvents } from './useWorkspaceRealtimeConversationEvents';
import { useWorkspaceRealtimeEventRouter } from './useWorkspaceRealtimeEventRouter';
import { useWorkspaceResumeSync } from './useWorkspaceResumeSync';
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
  canActOnMembershipRequest,
  isPendingCommunityInvitationFor,
  isPendingConversationInvitationFor,
  stableUniqueKey,
} from './workspaceNotificationState';

const seenCommunityMembershipRequests = new SeenCommunityMembershipRequests();

type LoadState = 'idle' | 'loading' | 'error';
type CallMediaEncryptionInput = {
  mediaEncryptionEnabled: boolean;
  mediaEncryptionKey?: string;
  mediaEncryptionUnavailableReason?: CallMediaEncryptionUnavailableReason;
};
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
  const preloadedConversationMessagesRef = useRef(
    preloadedConversationMessages,
  );
  const initialPreloadedMessages = preloadedConversationMessages
    ? MessageCollection.merge([], preloadedConversationMessages.messages)
    : [];
  const loadedMessagesConversationIdRef = useRef<string | null>(
    preloadedConversationMessages?.conversationId ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => initialPreloadedMessages,
  );
  const [messageCursor, setMessageCursor] = useState<string | null>(
    preloadedConversationMessages?.nextCursor ?? null,
  );
  const [messageState, setMessageState] = useState<LoadState>(
    preloadedConversationMessages ? 'idle' : 'loading',
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [communityRealtimeEvent, setCommunityRealtimeEvent] =
    useState<RealtimeDomainEvent | null>(null);
  const [conversationRealtimeEvent, setConversationRealtimeEvent] =
    useState<RealtimeDomainEvent | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<
    'connected' | 'reconnecting'
  >('reconnecting');
  const [realtimeEventsOpen, setRealtimeEventsOpen] = useState(false);
  const [realtimeEventLog, setRealtimeEventLog] = useState<
    RealtimeDomainEvent[]
  >([]);
  const draftSyncTimersRef = useRef(new Map<string, number>());
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
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [groupInviteRequest, setGroupInviteRequest] = useState(0);
  const [communityMembersOpen, setCommunityMembersOpen] = useState(false);
  const [nodeSettingsOpen, setNodeSettingsOpen] = useState(false);
  const [networkSynchronizationStatus, setNetworkSynchronizationStatus] =
    useState<NetworkSynchronizationStatus | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenMembershipRequestIds, setSeenMembershipRequestIds] = useState<
    string[]
  >(() => seenCommunityMembershipRequests.get(session.identity.id));
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
  const clearNewMessageCount = useCallback(() => setNewMessageCount(0), []);
  const initialRenderedCommunityIdRef = useRef<string | null>(null);
  const {
    bottomRef,
    isScrolledNearBottom,
    jumpToLatestMessages,
    keepMessageBottomUntilRef,
    lastScrollTopRef,
    messageScrollAnchorRef,
    scrollerRef,
    scrollMessagesToBottom,
  } = useMessageViewport({
    layoutKey: activeConversationId,
    messageCount: messages.length,
    messageState,
    onJumpToLatest: clearNewMessageCount,
  });
  const messageCursorRef = useRef<string | null>(
    preloadedConversationMessages?.nextCursor ?? null,
  );
  const messageAbortRef = useRef<AbortController | null>(null);
  const messageRequestRef = useRef(0);
  const messageStateRef = useRef<LoadState>(
    preloadedConversationMessages ? 'idle' : 'loading',
  );
  const messagesRef = useRef<ChatMessage[]>(initialPreloadedMessages);
  const activeCallRef = useRef<CallSession | null>(null);
  const callStartupSyncIdentityRef = useRef<string | null>(null);
  const callListRequestRef = useRef<Promise<CallResource[]> | null>(null);
  const reconcileCallResourceRef = useRef<(call: CallResource) => void>(
    () => undefined,
  );
  const sessionRef = useRef(session);
  const suppressMessageLoadsUntilRef = useRef(0);
  const {
    activeCall,
    callMediaConnections,
    endCall,
    receiveSignal,
    reconcileCall,
    retryMicrophone,
    setParticipantScreenShareVolume,
    setParticipantVolume,
    setScreenShareQuality,
    startCall,
    toggleCamera,
    toggleDeafen,
    toggleMediaEncryption,
    toggleMute,
    toggleNoiseCancellation,
    toggleScreenShare,
  } = useCallSession();
  const {
    mediaEncryptionEnabled: callMediaEncryptionEnabled,
    noiseCancellationEnabled: callNoiseCancellationEnabled,
    requestOptionalLocalAudio,
    stopLocalAudio,
    toggleCallMediaEncryption,
    toggleCallNoiseCancellation,
  } = useCallMediaAccess({
    identityId: session.identity.id,
    onError: setSendError,
    toggleMediaEncryption,
    toggleNoiseCancellation,
  });
  const {
    clearSidebarGesture,
    handleWorkspacePointerDown,
    handleWorkspacePointerMove,
  } = useSidebarGesture(sidebarOpen, setSidebarOpen);
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
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const listCallsForWorkspace = useCallback(() => {
    const activeRequest = callListRequestRef.current;

    if (activeRequest) return activeRequest;

    const request = applicationContainer.calls
      .list(sessionRef.current)
      .finally(() => {
        if (callListRequestRef.current === request) {
          callListRequestRef.current = null;
        }
      });

    callListRequestRef.current = request;

    return request;
  }, []);

  useEffect(() => {
    setSeenMembershipRequestIds(
      seenCommunityMembershipRequests.get(session.identity.id),
    );
  }, [session.identity.id]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messageStateRef.current = messageState;
  }, [messageState]);

  const setMessageLoadState = useCallback((state: LoadState) => {
    messageStateRef.current = state;
    setMessageState(state);
  }, []);
  const suppressMessageLoadsBriefly = useCallback(() => {
    suppressMessageLoadsUntilRef.current = Date.now() + 800;
  }, []);

  const openNotificationsPanel = useCallback(() => {
    suppressMessageLoadsBriefly();
    void enablePushNotifications();
    setNotificationsOpen(true);
  }, [enablePushNotifications, suppressMessageLoadsBriefly]);

  const closeNotificationsPanel = useCallback(() => {
    suppressMessageLoadsBriefly();
    setNotificationsOpen(false);
  }, [suppressMessageLoadsBriefly]);
  const openNodeSettings = useCallback(() => {
    setNodeSettingsOpen(true);
    void onPeersReload();
  }, [onPeersReload]);

  const openRealtimeEvents = useCallback(() => {
    setRealtimeEventLog([]);
    setRealtimeEventsOpen(true);
  }, []);

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
  const activeConversationDraft = activeConversation?.id
    ? (drafts[activeConversation.id] ?? '')
    : '';

  useEffect(() => {
    setConversationThread(null);
  }, [activeConversation?.id]);

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
  }, [activeConversation?.id, session]);

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

  useEffect(() => {
    let cancelled = false;

    void applicationContainer.messages
      .listDrafts(session)
      .then((remoteDrafts) => {
        if (cancelled) return;

        setDrafts((current) => {
          const next = { ...current };

          for (const draft of remoteDrafts) {
            if (next[draft.conversationId] === undefined) {
              next[draft.conversationId] = draft.content;
            }
          }

          return next;
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [session, setDrafts]);

  const scheduleConversationDraftSync = useCallback(
    (conversationId: string, value: string) => {
      const currentTimer = draftSyncTimersRef.current.get(conversationId);

      if (currentTimer) window.clearTimeout(currentTimer);

      const timer = window.setTimeout(() => {
        draftSyncTimersRef.current.delete(conversationId);

        if (value.trim()) {
          void applicationContainer.messages
            .saveDraft(session, conversationId, value)
            .catch(() => undefined);

          return;
        }

        void applicationContainer.messages
          .deleteDraft(session, conversationId)
          .catch(() => undefined);
      }, 700);

      draftSyncTimersRef.current.set(conversationId, timer);
    },
    [session],
  );

  useEffect(
    () => () => {
      for (const timer of draftSyncTimersRef.current.values()) {
        window.clearTimeout(timer);
      }

      draftSyncTimersRef.current.clear();
    },
    [],
  );

  const visibleCommunityUnreadCountsById = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(communityUnreadCountsById).map(
          ([communityId, channelCounts]) => [
            communityId,
            Object.fromEntries(
              Object.entries(channelCounts).filter(([channelId]) => {
                const setting = NotificationSettingsPolicy.resolve(
                  notificationSettingsByScopeKey,
                  {
                    channelId,
                    communityId,
                    type: 'community_channel',
                  },
                );

                return !NotificationSettingsPolicy.isMuted(setting);
              }),
            ),
          ],
        ),
      ) as Record<string, Record<string, number>>,
    [communityUnreadCountsById, notificationSettingsByScopeKey],
  );
  const communityUnreadCounts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(visibleCommunityUnreadCountsById).map(
          ([communityId, channels]) => [
            communityId,
            Object.values(channels).reduce((total, count) => total + count, 0),
          ],
        ),
      ) as Record<string, number>,
    [visibleCommunityUnreadCountsById],
  );
  const clearCommunityChannelUnread = useCallback(
    (communityId: string, channelId: string) => {
      setCommunityUnreadCountsById((current) => {
        if (!current[communityId]?.[channelId]) return current;

        const nextCommunity = { ...current[communityId] };

        delete nextCommunity[channelId];

        return {
          ...current,
          [communityId]: nextCommunity,
        };
      });
    },
    [],
  );
  const markCommunityChannelUnread = useCallback(
    (communityId: string, channelId: string) => {
      setCommunityUnreadCountsById((current) => ({
        ...current,
        [communityId]: {
          ...(current[communityId] ?? {}),
          [channelId]: (current[communityId]?.[channelId] ?? 0) + 1,
        },
      }));
    },
    [],
  );
  const updateActiveConversationDraft = useCallback(
    (value: string) => {
      if (!activeConversation?.id) return;

      scheduleConversationDraftSync(activeConversation.id, value);
      setDrafts((current) => ({
        ...current,
        [activeConversation.id]: value,
      }));
    },
    [activeConversation?.id, scheduleConversationDraftSync, setDrafts],
  );
  const cancelMessageEdit = useCallback(() => {
    if (!activeConversation?.id) {
      setEditingMessage(null);

      return;
    }

    const previousDraft = editingMessage?.previousDraft ?? '';

    setEditingMessage(null);
    setDrafts((current) => ({
      ...current,
      [activeConversation.id]: previousDraft,
    }));
  }, [activeConversation?.id, editingMessage?.previousDraft, setDrafts]);
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
    accept: acceptNotification,
    action: notificationAction,
    archive: archiveNotification,
    decline: declineNotification,
    error: notificationError,
    list: notificationList,
    markVisibleAsSeen: markVisibleNotificationsAsSeen,
    refresh: refreshNotifications,
    unreadCount: unreadNotificationCount,
    visible: visibleNotifications,
  } = useNotifications({
    onAccepted: handleNotificationAccepted,
    onAcceptedPanelClose: closeNotificationsPanel,
    session,
  });
  const {
    accept: acceptMembershipRequest,
    action: membershipRequestAction,
    decline: declineMembershipRequest,
    error: membershipRequestError,
    refresh: refreshMembershipRequests,
    requests: membershipRequests,
    setRequests: setMembershipRequests,
  } = useCommunityMembershipRequests({
    onCommunitiesReload,
    session,
  });
  const actionableMembershipRequests = useMemo(
    () =>
      membershipRequests.filter((request) =>
        canActOnMembershipRequest(request, communities, session.identity.id),
      ),
    [communities, membershipRequests, session.identity.id],
  );
  const unseenMembershipRequestCount = useMemo(
    () =>
      actionableMembershipRequests.filter(
        (request) => !seenMembershipRequestIds.includes(request.id),
      ).length,
    [actionableMembershipRequests, seenMembershipRequestIds],
  );
  const inboxNotificationCount =
    unreadNotificationCount + unseenMembershipRequestCount;
  const markVisibleMembershipRequestsAsSeen = useCallback(() => {
    const requestIds = actionableMembershipRequests.map(
      (request) => request.id,
    );

    if (requestIds.length === 0) return;

    setSeenMembershipRequestIds(
      seenCommunityMembershipRequests.markSeen(session.identity.id, requestIds),
    );
  }, [actionableMembershipRequests, session.identity.id]);

  useEffect(() => {
    if (!notificationsOpen) return;

    markVisibleNotificationsAsSeen();
    markVisibleMembershipRequestsAsSeen();
  }, [
    markVisibleMembershipRequestsAsSeen,
    markVisibleNotificationsAsSeen,
    notificationsOpen,
  ]);
  const {
    communityAvatarUrls: notificationCommunityAvatarUrls,
    communityPreviews: notificationCommunityPreviews,
  } = useNotificationCommunityPreviews({
    communities,
    session,
    visibleNotifications,
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
  const { handleScroll } = useWorkspaceMessageHistory({
    activeConversation,
    activeConversationKey,
    isScrolledNearBottom,
    keepMessageBottomUntilRef,
    lastScrollTopRef,
    messageCursorRef,
    messageRequestRef,
    messageScrollAnchorRef,
    messagesRef,
    messageStateRef,
    scrollerRef,
    sessionRef,
    setMessageLoadState,
    setMessages,
    setNewMessageCount,
    setSendError,
    suppressMessageLoadsUntilRef,
    updateMessageCursor,
    workspaceMode,
  });
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
  const callDetailsForResource = useCallback(
    (call: CallResource) =>
      resolveWorkspaceCallDetails({
        call,
        communities,
        conversations,
        currentIdentity: session.identity,
        fallbackLabels: {
          noConversation: copy.chat.noConversation,
          privateCommunity: copy.communities.privateCommunity,
          voiceChannel: copy.calls.voiceChannel,
        },
        identityNames,
        identityPictures,
        identityProfiles,
        keychain: session.keychain,
      }),
    [
      communities,
      conversations,
      identityNames,
      identityPictures,
      identityProfiles,
      session.identity,
      session.keychain,
    ],
  );
  const callMediaEncryptionForResource = useCallback(
    (call: CallResource): CallMediaEncryptionInput => {
      const scope = call.scope;
      const disabled = (reason: CallMediaEncryptionUnavailableReason) => ({
        mediaEncryptionEnabled: callMediaEncryptionEnabled,
        mediaEncryptionUnavailableReason: reason,
      });
      const enabled = (entry: ConversationKeyEntry | undefined) =>
        entry?.key
          ? {
              mediaEncryptionEnabled: callMediaEncryptionEnabled,
              mediaEncryptionKey: entry.key,
            }
          : disabled('missing-key');

      if (scope.type === 'community_channel') {
        const community = communities.find(
          (item) => item.id === scope.communityId,
        );

        if (community?.visibility === 'public') {
          return disabled('public-community');
        }

        return enabled(session.keychain.conversations[scope.communityId]);
      }

      return enabled(
        ConversationKeychain.entry(
          session.keychain,
          session.identity.id,
          scope.conversationId,
        ),
      );
    },
    [
      callMediaEncryptionEnabled,
      communities,
      session.identity.id,
      session.keychain,
    ],
  );
  const { incomingCall, reconcileCallResource, setIncomingCall } =
    useCallResourceReconciliation({
      activeCall,
      callDetailsForResource,
      currentIdentityId: session.identity.id,
      endCall,
      reconcileCall,
      setCommunities,
    });
  const handleRealtimeCallEvent = useWorkspaceRealtimeCallEvents({
    activeCallRef,
    receiveSignal,
    reconcileCallResource,
    sessionRef,
  });

  useEffect(() => {
    reconcileCallResourceRef.current = reconcileCallResource;
  }, [reconcileCallResource]);

  const {
    cleanupJoinedCalls,
    leaveActiveCall,
    leaveCurrentCallForSwitch,
    removeCurrentIdentityFromVoicePresence,
  } = useCallDeparture({
    activeCall,
    callDetailsForResource,
    endCall,
    listCalls: listCallsForWorkspace,
    onCommunitiesReload,
    reconcileCallResource,
    session,
    setCommunities,
  });

  const callSignalSender = useCallback(
    (callId: string) =>
      async (
        recipientIdentityId: string,
        signalType: CallSignalType,
        payload: Record<string, unknown>,
      ) => {
        logCallDebug('workspace:send-call-signal', {
          callId,
          recipientIdentityId,
          signalType,
        });
        await applicationContainer.calls.sendSignal(
          sessionRef.current,
          callId,
          {
            payload,
            recipientIdentityId,
            signalType,
          },
        );
      },
    [],
  );
  const loadCallIceConfig = useCallback(async () => {
    try {
      return await applicationContainer.calls.getIceServers(sessionRef.current);
    } catch (caught) {
      logCallError('workspace:call:ice-config-unavailable', caught);

      throw new Error(copy.calls.iceServersUnavailable);
    }
  }, []);
  const {
    acceptIncomingCall,
    declineIncomingCall,
    isCallActionInProgress,
    startCommunityVoiceCall,
    startConversationCall,
  } = useCallStartActions({
    activeCall,
    activeCommunity,
    callDetailsForResource,
    callMediaEncryptionForResource,
    callNoiseCancellationEnabled,
    callSignalSender,
    cleanupJoinedCalls,
    incomingCall,
    leaveCurrentCallForSwitch,
    loadCallIceConfig,
    requestOptionalLocalAudio,
    session,
    setIncomingCall,
    setSendError,
    startCall,
    stopLocalAudio,
  });
  const heartbeatActiveCall = useCallback(
    async (
      callId: string,
      mediaConnections: CallParticipantMediaConnection[],
    ) => {
      await applicationContainer.calls.heartbeatParticipant(
        sessionRef.current,
        callId,
        mediaConnections,
      );
    },
    [],
  );

  useWorkspaceCallHeartbeat({
    activeCall,
    heartbeat: heartbeatActiveCall,
    mediaConnections: callMediaConnections,
  });

  useEffect(() => {
    if (!communityVoiceTopologyKey) return undefined;

    let cancelled = false;

    void listCallsForWorkspace()
      .then((calls) => {
        if (cancelled) return;

        setCommunities((current) =>
          communitiesWithCallVoicePresence(current, calls),
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [communityVoiceTopologyKey, listCallsForWorkspace, setCommunities]);

  useEffect(() => {
    let cancelled = false;
    const identityId = session.identity.id;

    if (callStartupSyncIdentityRef.current === identityId) return undefined;

    callStartupSyncIdentityRef.current = identityId;

    void listCallsForWorkspace()
      .then(async (calls) => {
        if (cancelled) return;

        const staleJoinedCalls = calls.filter(
          (call) =>
            call.status === 'active' &&
            call.scope.type === 'community_channel' &&
            call.participants.some(
              (participant) =>
                participant.identityId === identityId && participant.connected,
            ),
        );

        if (
          staleJoinedCalls.length > 0 &&
          !activeCallRef.current &&
          !isCallActionInProgress()
        ) {
          await Promise.all(
            staleJoinedCalls.map((call) =>
              applicationContainer.calls
                .leave(sessionRef.current, call.id)
                .catch(() => undefined),
            ),
          );
          removeCurrentIdentityFromVoicePresence();
          await onCommunitiesReload().catch(() => undefined);

          return;
        }

        calls.forEach((call) => reconcileCallResourceRef.current(call));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    listCallsForWorkspace,
    isCallActionInProgress,
    onCommunitiesReload,
    removeCurrentIdentityFromVoicePresence,
    session.identity.id,
  ]);

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

  const refreshConversations = useCallback(async () => {
    const next = await applicationContainer.conversations.list(session);

    setConversations(next);

    return next;
  }, [session, setConversations]);

  const refreshSession = useCallback(async () => {
    const result = await applicationContainer.session.refresh(session);

    setSession(result.session);
    setConversations(result.conversations);
  }, [session, setConversations, setSession]);

  const closeTransientUi = useCallback(() => {
    setMessageContextMenu(null);
    setRawMessage(null);
    setReplyTarget(null);
    cancelMessageEdit();
    setIsCreateOpen(false);
    setIsCreateCommunityOpen(false);
    closeNotificationsPanel();
    setNodeSettingsOpen(false);
    setRealtimeEventsOpen(false);
    setInspectorOpen(false);
    setCommunityMembersOpen(false);
    setSidebarOpen(false);
  }, [cancelMessageEdit, closeNotificationsPanel]);

  const markConversationReadUntil = useCallback(
    (conversationId: string, loadedMessages: ChatMessage[]) => {
      const lastMessage = MessageCollection.lastDelivered(loadedMessages);

      if (!lastMessage) return;

      clearUnreadMessages(conversationId);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      );
      void applicationContainer.conversations
        .markReadUntil(sessionRef.current, conversationId, lastMessage.id)
        .catch(() => undefined);
    },
    [clearUnreadMessages, setConversations],
  );

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
      const controller = new AbortController();

      messageAbortRef.current?.abort();
      messageAbortRef.current = controller;
      messageRequestRef.current = requestId;
      loadedMessagesConversationIdRef.current = null;
      setMessages([]);
      updateMessageCursor(null);
      setMessageLoadState('loading');
      setSendError(null);
      try {
        const result = await applicationContainer.messages.load(
          sessionRef.current,
          conversationId,
          null,
          { signal: controller.signal },
        );

        if (messageRequestRef.current !== requestId) return;

        startTransition(() => {
          setMessages(MessageCollection.merge([], result.messages));
          updateMessageCursor(result.nextCursor ?? null);
          setMessageLoadState('idle');
          loadedMessagesConversationIdRef.current = conversationId;
        });
        markConversationReadUntil(conversationId, result.messages);
        scrollMessagesToBottom('auto', true);
      } catch (caught) {
        if (messageRequestRef.current !== requestId) return;

        if (controller.signal.aborted) return;

        loadedMessagesConversationIdRef.current = null;
        setMessages([]);
        setMessageLoadState('error');
        setSendError(
          toUserErrorMessage(caught, copy.workspace.loadMessagesError),
        );

        return;
      }

      if (messageRequestRef.current !== requestId) return;

      if (messageAbortRef.current === controller) {
        messageAbortRef.current = null;
      }
    },
    [
      markConversationReadUntil,
      scrollMessagesToBottom,
      setMessageLoadState,
      updateMessageCursor,
    ],
  );

  useEffect(() => {
    if (workspaceMode !== 'messages') return;

    if (!activeConversation?.id) return;
    setReplyTarget(null);
    setEditingMessage(null);
    setNewMessageCount(0);
    lastScrollTopRef.current = 0;

    if (!activeConversationKeyId) {
      messageAbortRef.current?.abort();
      messageAbortRef.current = null;
      loadedMessagesConversationIdRef.current = null;
      setMessages([]);
      updateMessageCursor(null);
      lastScrollTopRef.current = 0;
      setMessageLoadState('idle');

      return;
    }

    const preloaded = preloadedConversationMessagesRef.current;

    if (preloaded?.conversationId === activeConversation.id) {
      preloadedConversationMessagesRef.current = null;
      loadedMessagesConversationIdRef.current = activeConversation.id;
      setMessages(MessageCollection.merge([], preloaded.messages));
      updateMessageCursor(preloaded.nextCursor ?? null);
      setMessageLoadState('idle');
      markConversationReadUntil(activeConversation.id, preloaded.messages);
      scrollMessagesToBottom('auto', true);

      return;
    }

    if (loadedMessagesConversationIdRef.current === activeConversation.id) {
      setMessageLoadState('idle');
      scrollMessagesToBottom('auto', true);

      return;
    }

    void loadActiveMessages(activeConversation.id);
  }, [
    activeConversation?.id,
    activeConversationKeyId,
    loadActiveMessages,
    markConversationReadUntil,
    scrollMessagesToBottom,
    setMessageLoadState,
    updateMessageCursor,
    workspaceMode,
  ]);

  useWorkspaceResumeSync({
    activeConversationId: activeConversation?.id,
    activeConversationKeyId,
    loadActiveMessages,
    loadedMessages: messagesRef,
    onCommunitiesReload,
    refreshConversations,
    workspaceMode,
  });

  const {
    retryMessage,
    sendMessage: handleSend,
    sendSticker: handleSendSticker,
  } = useConversationMessageDelivery({
    activeConversation,
    messagesRef,
    onAttachmentProgressChange: setAttachmentProgress,
    onConversationsChange: setConversations,
    onErrorChange: setSendError,
    onMessagesChange: setMessages,
    onReplyTargetChange: setReplyTarget,
    replyTarget,
    scrollToBottom: scrollMessagesToBottom,
    session,
  });

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
  const copyMessageContent = (message: ChatMessage) => {
    if (navigator.clipboard && message.content) {
      void navigator.clipboard.writeText(message.content);
    }

    setMessageContextMenu(null);
  };

  const scrollToMessage = (messageId: string) => {
    requestAnimationFrame(() => {
      const element = scrollerRef.current?.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(messageId)}"]`,
      );

      if (!element) return;

      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusTarget =
        element.querySelector<HTMLElement>('[data-message-bubble]') ?? element;

      focusTarget.classList.add('message-focus-ring');
      window.setTimeout(
        () => focusTarget.classList.remove('message-focus-ring'),
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
    setMessageLoadState('loading');
    try {
      const result = await applicationContainer.messages.loadAround(
        session,
        activeConversation.id,
        messageId,
      );

      setMessages((current) =>
        MessageCollection.merge(current, result.messages),
      );
      updateMessageCursor(result.previousCursor ?? null);

      if (result.messages.some((message) => message.id === messageId)) {
        scrollToMessage(messageId);

        return;
      }

      setSendError(copy.messages.replyTargetNotFound);
    } catch (caught) {
      setSendError(toUserErrorMessage(caught, copy.workspace.loadOlderError));
    } finally {
      setMessageLoadState('idle');
    }
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!activeConversation?.id) return;

    setMessageContextMenu(null);
    setSendError(null);
    try {
      await applicationContainer.messages.delete(
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

  const startEditingMessage = (message: ChatMessage) => {
    if (!activeConversation?.id) return;

    setMessageContextMenu(null);
    setReplyTarget(null);
    setEditingMessage({
      message,
      previousDraft: activeConversationDraft,
    });
    updateActiveConversationDraft(message.content);
  };

  const handleEditMessage = async (content: string) => {
    if (!activeConversation?.id || !editingMessage) return;

    setSendError(null);
    try {
      const editEvent = await applicationContainer.messages.edit(
        session,
        activeConversation.id,
        editingMessage.message.id,
        content,
      );

      setMessages((current) => MessageCollection.merge(current, [editEvent]));
      setEditingMessage(null);
      updateActiveConversationDraft('');
    } catch (caught) {
      setSendError(toUserErrorMessage(caught, copy.messages.editError));
    }
  };

  const handleToggleMessageReaction = async (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => {
    if (!activeConversation?.id) return;

    const conversationId = activeConversation.id;

    setSendError(null);
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? MessageReactionUpdater.update(
              item,
              session.identity.id,
              emoji,
              reacted ? 'remove' : 'add',
            )
          : item,
      ),
    );

    try {
      if (reacted) {
        await applicationContainer.messages.removeReactionFrom(
          session,
          conversationId,
          message.id,
          emoji,
        );
      } else {
        await applicationContainer.messages.addReactionTo(
          session,
          conversationId,
          message.id,
          emoji,
        );
      }
    } catch (caught) {
      setSendError(toUserErrorMessage(caught, copy.messages.reactionError));
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? MessageReactionUpdater.update(
                item,
                session.identity.id,
                emoji,
                reacted ? 'add' : 'remove',
              )
            : item,
        ),
      );
    }
  };

  const handleConversationCreated = (
    nextSession: Session,
    conversation: ConversationResource,
  ) => {
    setSession(nextSession);
    setConversations(
      ConversationTimeline.sortByLatestMessage([
        conversation,
        ...conversations.filter((item) => item.id !== conversation.id),
      ]),
    );
    setActiveConversationId(conversation.id);
    setIsCreateOpen(false);
    setSidebarOpen(false);
  };

  const openOrCreateConversationWithIdentity = useCallback(
    async (
      identityId: string,
      identity?: IdentityResource,
      preferredNetworkId?: string,
    ) => {
      if (identityId === session.identity.id) return;

      const existingConversation = conversations.find(
        (conversation) =>
          ConversationPeer.identityId(
            conversation,
            session.identity.id,
            session.keychain,
          ) === identityId,
      );

      if (existingConversation) {
        setWorkspaceMode('messages');
        setActiveConversationId(existingConversation.id);
        setSidebarOpen(false);
        setCommunityMembersOpen(false);

        return;
      }

      const sharedNetwork = new SharedNetworkSelectorDomainService().select(
        session.identity.networks.map((networkId) =>
          NetworkId.fromString(networkId),
        ),
        (identity?.networks ?? []).map((networkId) =>
          NetworkId.fromString(networkId),
        ),
        NetworkId.fromOptional(preferredNetworkId),
      );

      if (!sharedNetwork.isAvailable()) {
        throw new Error(copy.dialog.noSharedNetwork);
      }

      const result = await applicationContainer.conversations.create(
        sessionRef.current,
        identityId,
        sharedNetwork.toString(),
      );
      const nextSession = {
        ...sessionRef.current,
        keychain: result.keychain,
        keychainExternalIdentifier: result.keychainExternalIdentifier,
      };

      setSession(nextSession);

      if (identity) rememberIdentity(identity);
      setConversations((current) =>
        ConversationTimeline.sortByLatestMessage([
          result.conversation,
          ...current.filter((item) => item.id !== result.conversation.id),
        ]),
      );
      setWorkspaceMode('messages');
      setActiveConversationId(result.conversation.id);
      setSidebarOpen(false);
      setCommunityMembersOpen(false);
    },
    [
      conversations,
      rememberIdentity,
      session.identity.id,
      session.identity.networks,
      session.keychain,
      setConversations,
      setSession,
    ],
  );

  const handleConversationKeyImported = async (
    keyEntry: ConversationKeyEntry,
  ) => {
    const result = await applicationContainer.identities.publishKeychain(
      session,
      {
        ...session.keychain,
        conversations: {
          ...session.keychain.conversations,
          [keyEntry.conversationId]: keyEntry,
        },
      },
    );

    setSession({
      ...session,
      keychain: result.keychain,
      keychainExternalIdentifier: result.keychainExternalIdentifier,
    });
  };

  const updateCommunityState = useCallback(
    (communityId: string, updater: (community: Community) => Community) => {
      setCommunities((current) =>
        current.map((community) =>
          community.id === communityId ? updater(community) : community,
        ),
      );
    },
    [setCommunities],
  );
  const updateCommunityChannels = useCallback(
    (communityId: string, channels: CommunityChannel[]): void => {
      const splitChannels = CommunityChannels.split(channels);

      setCommunities((current) =>
        current.map((community) =>
          community.id === communityId
            ? { ...community, ...splitChannels }
            : community,
        ),
      );
    },
    [setCommunities],
  );
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
  const leaveCommunityFromRail = useCallback(
    async (community: Community) => {
      if (!window.confirm(copy.communities.leaveConfirm)) return;

      try {
        const result = await applicationContainer.communities.leave(
          session,
          community.id,
        );
        const updatedCommunity = result.community ?? community;

        setSession({
          ...session,
          keychain: result.keychain,
          keychainExternalIdentifier: result.keychainExternalIdentifier,
        });

        setCommunities((current) =>
          current.filter((item) => item.id !== updatedCommunity.id),
        );

        if (activeCommunityId === updatedCommunity.id) {
          setActiveCommunityId(null);
          setWorkspaceMode('messages');
          setSidebarOpen(false);
        }
      } catch (caught) {
        setSendError(toUserErrorMessage(caught, copy.communities.leaveError));
      }
    },
    [
      activeCommunityId,
      session,
      setActiveCommunityId,
      setCommunities,
      setSession,
      setSidebarOpen,
      setWorkspaceMode,
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

  return (
    <section
      className="relative z-10 min-h-full overflow-hidden overscroll-none"
      onPointerCancel={clearSidebarGesture}
      onPointerDown={handleWorkspacePointerDown}
      onPointerMove={handleWorkspacePointerMove}
      onPointerUp={clearSidebarGesture}
    >
      <div className="app-workspace grid w-full grid-cols-1 gap-0 px-0 pb-0 lg:grid-cols-[82px_330px_minmax(0,1fr)] xl:grid-cols-[82px_330px_minmax(0,1fr)_320px]">
        <Rail
          className="hidden lg:flex"
          activeMessages={workspaceMode === 'messages'}
          activeCommunityId={
            workspaceMode === 'community' ? activeCommunity?.id : null
          }
          communities={communities}
          communityNotificationSetting={communityNotificationSettingFor}
          communityUnreadCounts={communityUnreadCounts}
          messageNotificationCount={unreadMessageCount}
          notificationCount={inboxNotificationCount}
          onCommunityClick={(communityId) => {
            setActiveCommunityId(communityId);
            setWorkspaceMode('community');
            setSidebarOpen(false);
          }}
          onCommunityNotificationMuteToggle={toggleCommunityNotificationMute}
          onCommunityNotificationSettingsOpen={
            openCommunityNotificationSettings
          }
          onCommunityLeave={leaveCommunityFromRail}
          onCreateCommunityClick={() => setIsCreateCommunityOpen(true)}
          onMessagesClick={() => {
            setWorkspaceMode('messages');
            setSidebarOpen(false);
          }}
          onNotificationsClick={openNotificationsPanel}
          onSettingsClick={openNodeSettings}
          settingsAttention={nodeUnclaimed}
        />

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
                  className="lg:hidden"
                  activeMessages
                  activeCommunityId={null}
                  communities={communities}
                  communityNotificationSetting={communityNotificationSettingFor}
                  communityUnreadCounts={communityUnreadCounts}
                  messageNotificationCount={unreadMessageCount}
                  notificationCount={inboxNotificationCount}
                  onCommunityClick={(communityId) => {
                    setActiveCommunityId(communityId);
                    setWorkspaceMode('community');
                    setSidebarOpen(false);
                  }}
                  onCommunityNotificationMuteToggle={
                    toggleCommunityNotificationMute
                  }
                  onCommunityNotificationSettingsOpen={
                    openCommunityNotificationSettings
                  }
                  onCommunityLeave={leaveCommunityFromRail}
                  onCreateCommunityClick={() => setIsCreateCommunityOpen(true)}
                  onMessagesClick={() => {
                    setWorkspaceMode('messages');
                    setSidebarOpen(false);
                  }}
                  onNotificationsClick={openNotificationsPanel}
                  onSettingsClick={openNodeSettings}
                  onInspectorClick={() => setInspectorOpen(true)}
                  peerCount={peers.length}
                  settingsAttention={nodeUnclaimed}
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
                      setSidebarOpen(false);
                    }}
                    onConversationNotificationMuteToggle={
                      toggleConversationNotificationMute
                    }
                    onConversationNotificationSettingsOpen={
                      openConversationNotificationSettings
                    }
                    onCreate={() => setIsCreateOpen(true)}
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
              onClick={() => setSidebarOpen(false)}
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
                onMessageMenuOpen={(message, x, y) =>
                  setMessageContextMenu({ message, source: 'thread', x, y })
                }
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
                  onOpenSidebar={() => setSidebarOpen(true)}
                  onNotificationMuteToggle={toggleNotificationMute}
                  onNotificationSettingsOpen={openNotificationSettings}
                  onCreate={() => setIsCreateOpen(true)}
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
                  onCancelReply={() => setReplyTarget(null)}
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
                  activeCommunityId={activeCommunity.id}
                  communities={communities}
                  communityNotificationSetting={communityNotificationSettingFor}
                  communityUnreadCounts={communityUnreadCounts}
                  messageNotificationCount={unreadMessageCount}
                  notificationCount={inboxNotificationCount}
                  onCommunityClick={(communityId) => {
                    setActiveCommunityId(communityId);
                    setWorkspaceMode('community');
                    setSidebarOpen(false);
                  }}
                  onCommunityNotificationMuteToggle={
                    toggleCommunityNotificationMute
                  }
                  onCommunityNotificationSettingsOpen={
                    openCommunityNotificationSettings
                  }
                  onCommunityLeave={leaveCommunityFromRail}
                  onCreateCommunityClick={() => setIsCreateCommunityOpen(true)}
                  onMessagesClick={() => {
                    setWorkspaceMode('messages');
                    setSidebarOpen(false);
                  }}
                  onNotificationsClick={openNotificationsPanel}
                  onSettingsClick={openNodeSettings}
                  onInspectorClick={() => {
                    setSidebarOpen(false);
                    setCommunityMembersOpen(true);
                  }}
                  peerCount={peers.length}
                  settingsAttention={nodeUnclaimed}
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
              onCommunityUpdated={(community) =>
                setCommunities((current) =>
                  current.map((item) =>
                    item.id === community.id
                      ? CommunityList.preservingCommunityVoicePresence(
                          community,
                          item,
                        )
                      : item,
                  ),
                )
              }
              onCommunityChannelsUpdated={updateCommunityChannels}
              onInvitationAccept={(notification) =>
                void acceptNotification(notification)
              }
              onCommunityLeft={(community) =>
                setCommunities((current) =>
                  current.filter((item) => item.id !== community.id),
                )
              }
              onChannelViewed={(channelId) =>
                clearCommunityChannelUnread(activeCommunity.id, channelId)
              }
              onLogout={logout}
              onMobileSidebarClose={() => setSidebarOpen(false)}
              onMobileMembersClose={() => setCommunityMembersOpen(false)}
              onNotificationMuteToggle={toggleNotificationMute}
              onNotificationSettingsOpen={openNotificationSettings}
              onOpenMobileSidebar={() => setSidebarOpen(true)}
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
            activeConversation={activeConversation}
            activeConversationPeerIdentityId={activeConversationPeerIdentityId}
            archiveNotification={archiveNotification}
            communities={communities}
            communityAvatarUrls={notificationCommunityAvatarUrls}
            communityPreviews={notificationCommunityPreviews}
            conversations={conversations}
            identityNames={identityNames}
            identityPictures={identityPictures}
            identityProfiles={identityProfiles}
            incomingCall={incomingCall}
            inspectorOpen={inspectorOpen}
            isCreateCommunityOpen={isCreateCommunityOpen}
            isCreateOpen={isCreateOpen}
            membershipRequestAction={membershipRequestAction}
            membershipRequestError={membershipRequestError}
            membershipRequests={membershipRequests}
            messageContextMenu={messageContextMenu}
            messages={messages}
            node={node}
            nodeNetworks={nodeNetworks}
            nodeSettingsOpen={nodeSettingsOpen}
            networkSynchronizationStatus={networkSynchronizationStatus}
            notificationAction={notificationAction}
            notificationError={notificationError}
            notificationSettingsError={notificationSettingsError}
            notificationSettingsSetting={notificationSettingsSetting}
            notificationSettingsTarget={notificationSettingsTarget}
            notificationsOpen={notificationsOpen}
            peersLoading={peersLoading}
            peers={peers}
            presenceByIdentityId={presenceByIdentityId}
            rawMessage={rawMessage}
            realtimeEventLog={realtimeEventLog}
            realtimeEventsOpen={realtimeEventsOpen}
            session={session}
            visibleNotifications={visibleNotifications}
            onAcceptIncomingCall={acceptIncomingCall}
            onAcceptNotification={(notification) =>
              void acceptNotification(notification)
            }
            onCloseCreateCommunity={() => setIsCreateCommunityOpen(false)}
            onCloseCreateConversation={() => setIsCreateOpen(false)}
            onCloseInspector={() => setInspectorOpen(false)}
            onCloseMessageContextMenu={() => setMessageContextMenu(null)}
            onCloseNodeSettings={() => setNodeSettingsOpen(false)}
            onCloseNotificationSettings={closeNotificationSettings}
            onCloseNotifications={closeNotificationsPanel}
            onCloseRawMessage={() => setRawMessage(null)}
            onCloseRealtimeEvents={() => setRealtimeEventsOpen(false)}
            onCommunityCreated={({ community, session: nextSession }) => {
              setSession(nextSession);
              setCommunities((current) => [community, ...current]);
              setActiveCommunityId(community.id);
              setWorkspaceMode('community');
              setIsCreateCommunityOpen(false);
            }}
            onCommunityJoinRequested={(request: CommunityMembershipRequest) => {
              setMembershipRequests((current) => [
                request,
                ...current.filter((item) => item.id !== request.id),
              ]);

              if (request.status === 'accepted') {
                void applicationContainer.communities
                  .get(sessionRef.current, request.communityId)
                  .then((community) => {
                    setCommunities((current) => [
                      community,
                      ...current.filter((item) => item.id !== community.id),
                    ]);
                    setActiveCommunityId(community.id);
                    setWorkspaceMode('community');
                  })
                  .catch((caught) =>
                    setSendError(
                      toUserErrorMessage(
                        caught,
                        copy.communities.membershipError,
                      ),
                    ),
                  );
              }

              setIsCreateCommunityOpen(false);
            }}
            onConversationCreated={handleConversationCreated}
            onGroupInviteOpen={() =>
              setGroupInviteRequest((request) => request + 1)
            }
            onOpenConversationWithIdentity={
              openOrCreateConversationWithIdentity
            }
            onAcceptMembershipRequest={(requestId) =>
              void acceptMembershipRequest(requestId)
            }
            onDeclineIncomingCall={declineIncomingCall}
            onDeclineMembershipRequest={(requestId) =>
              void declineMembershipRequest(requestId)
            }
            onDeclineNotification={(notificationId) =>
              void declineNotification(notificationId)
            }
            onNotificationSettingReset={resetNotificationSetting}
            onNotificationSettingSave={saveNotificationSetting}
            onDeleteMessage={(message) =>
              void (messageContextMenu?.source === 'thread'
                ? handleDeleteConversationThreadMessage(message)
                : handleDeleteMessage(message))
            }
            onDownloadAttachment={(attachment) =>
              void downloadContextAttachment(attachment)
            }
            onEditMessage={(message) =>
              messageContextMenu?.source === 'thread'
                ? startEditingConversationThreadMessage(message)
                : startEditingMessage(message)
            }
            onCopyMessage={copyMessageContent}
            onOpenMessageThread={(message) => void openMessageThread(message)}
            onPinMessage={(message) => void pinMessage(message)}
            onReplyToMessage={(message) => {
              if (messageContextMenu?.source === 'thread') {
                startReplyingToConversationThreadMessage(message);

                return;
              }

              setMessageContextMenu(null);
              setEditingMessage(null);
              setReplyTarget(message);
            }}
            onNetworksUpdated={onNodeNetworksReload}
            onUnpinMessage={(message) => void unpinMessage(message)}
            pinnedMessageIds={pinnedMessageIds}
            onToggleReaction={(message, emoji, reacted) =>
              void handleToggleMessageReaction(message, emoji, reacted)
            }
            onViewRawMessage={(message) => {
              setRawMessage(message);
              setMessageContextMenu(null);
            }}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
