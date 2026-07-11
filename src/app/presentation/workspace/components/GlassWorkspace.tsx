import { UUID } from '@haskou/value-objects';
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

import type { NodeNetwork } from '../../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import type { Peer } from '../../../../contexts/networks/application/list-peers/ListPeers';
import type { NodeInfo } from '../../../../contexts/networks/infrastructure/http/NodeInfo';
import type {
  CallParticipant,
  CallParticipantMediaConnection,
  CallResource,
  CallSignalType,
  CallSession,
} from '../../../../contexts/calls/domain/callSession.types';
import type {
  ChatMessage,
  AttachmentProgress,
  AttachmentUploadOptions,
  Community,
  CommunityMembershipRequest,
  ConversationKeyEntry,
  ConversationResource,
  IdentityResource,
  MessageResource,
  NotificationResource,
  NotificationSettingScope,
  PollResource,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type {
  NetworkSynchronizationStatus,
  RealtimeDomainEvent,
} from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { PendingCommunityInviteLink } from '../../../../contexts/communities/presentation/view-models/communityInviteLink';
import type { PreloadedConversationMessages } from '../PreloadedConversationMessages';
import type { MessageContextMenuState } from './messageContextMenu';

import { applicationContainer } from '../../../composition/applicationContainer';
import { PendingMessageAttachments } from '../../../../contexts/attachments/domain/PendingMessageAttachments';
import { useAttachmentDownload } from '../../../../contexts/attachments/presentation/hooks/useAttachmentDownload';
import { CommunityAccessPolicy } from '../../../../contexts/communities/domain/CommunityAccessPolicy';
import { CommunityChannels } from '../../../../contexts/communities/domain/CommunityChannels';
import { ConversationKeychain } from '../../../../contexts/conversations/domain/ConversationKeychain';
import { ConversationTimeline } from '../../../../contexts/conversations/domain/ConversationTimeline';
import { ConversationPeer } from '../../../../contexts/conversations/domain/ConversationPeer';
import { MessageCollection } from '../../../../contexts/messages/domain/MessageCollection';
import { replyPreviewFromMessage } from '../../../../contexts/messages/presentation/view-models/replyPreviewFromMessage';
import { ThreadMessageVisibility } from '../../../../contexts/messages/presentation/view-models/ThreadMessageVisibility';
import { MessageScrollAnchor } from '../../../../contexts/messages/presentation/view-models/MessageScrollAnchor';
import { MessageReactions } from '../../../../contexts/messages/domain/MessageReactions';
import { MessageCollectionDialog } from '../../../../contexts/messages/presentation/components/MessageCollectionDialog';
import { MessageThreadPanel } from '../../../../contexts/messages/presentation/components/MessageThreadPanel';
import { SharedNetworkSelection } from '../../../../contexts/networks/domain/SharedNetworkSelection';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  logCallDebug,
  logCallError,
  logCallWarning,
} from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { useCallSession } from '../../../../contexts/calls/presentation/hooks/useCallSession';
import { useCallMediaAccess } from '../../../../contexts/calls/presentation/hooks/useCallMediaAccess';
import { participantJoinWasAccepted } from '../../../../contexts/calls/presentation/hooks/callPeerConnectionPlan';
import { CallSignalDeliveryTracker } from '../../../../contexts/calls/infrastructure/realtime/CallSignalDeliveryTracker';
import { SeenCommunityMembershipRequests } from '../../../../contexts/communities/infrastructure/storage/SeenCommunityMembershipRequests';
import { useCommunityMembershipRequests } from '../../../../contexts/communities/presentation/hooks/useCommunityMembershipRequests';
import {
  identityDisplayName,
  identityPrimaryDisplayName,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { useIdentityDirectory } from '../../../../contexts/identities/presentation/hooks/useIdentityDirectory';
import {
  acknowledgeRealtimeCallSignal,
  useRealtimeEvents,
} from '../../../../app/presentation/realtime/useRealtimeEvents';
import { useUnreadMessages } from '../../../../contexts/messages/presentation/hooks/useUnreadMessages';
import {
  deletePwaPushSubscription,
  showPwaNotification,
} from '../../../../contexts/notifications/infrastructure/browser/pwaNotifications';
import { useNotifications } from '../../../../contexts/notifications/presentation/hooks/useNotifications';
import { useNotificationScopeSettings } from '../../../../contexts/notifications/presentation/hooks/useNotificationScopeSettings';
import { useNotificationCommunityPreviews } from '../../../../contexts/notifications/presentation/hooks/useNotificationCommunityPreviews';
import { usePushNotificationRegistration } from '../../../../contexts/notifications/presentation/hooks/usePushNotificationRegistration';
import { NotificationSettingsPolicy } from '../../../../contexts/notifications/domain/NotificationSettingsPolicy';
import {
  communityNotificationPreview,
  conversationNotificationPreview,
} from '../../../../contexts/notifications/presentation/view-models/notificationPreviews';
import { presenceFromRealtimeEvent } from '../presenceFromRealtimeEvent';
import {
  useWorkspacePreferences,
  useWorkspacePreferenceState,
} from '../useWorkspacePreferences';
import { cx } from '../../../../shared/presentation/cx';
import { runWhenBrowserIdle } from '../../../../shared/presentation/runWhenBrowserIdle';
import {
  playAnsweredCallSound,
  playEndedCallSound,
  playNotificationSound,
  stopIncomingCallSound,
} from '../../../../shared/presentation/sounds';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { PushNotificationPrompt } from './PushNotificationPrompt';
import { Rail } from './Rail';
import { isBrowserPageVisible } from './isBrowserPageVisible';
import { useCommunitySelection } from './useCommunitySelection';
import { usePendingCommunityInvite } from './usePendingCommunityInvite';
import { useSidebarGesture } from './useSidebarGesture';
import { useWorkspaceCallHeartbeat } from './useWorkspaceCallHeartbeat';
import { useCallResourceReconciliation } from './useCallResourceReconciliation';
import { useCallDeparture } from './useCallDeparture';
import { useCallStartActions } from './useCallStartActions';
import { useWorkspaceNotificationActions } from './useWorkspaceNotificationActions';
import { useWorkspaceTyping } from './useWorkspaceTyping';
import { useMessageViewport } from './useMessageViewport';
import { useWorkspacePresence } from './useWorkspacePresence';
import { useWorkspaceResumeSync } from './useWorkspaceResumeSync';
import {
  callIdFromRealtimeEvent,
  callSignalTypeAttribute,
  communityAttribute,
  communityChannelAttribute,
  eventAggregateId,
  numberAttribute,
  recordAttribute,
  stringAttribute,
} from './realtimeEventAttributes';
import { ChatColumn } from './ChatColumn';
import { CommunityWorkspaceStartupFallback } from './CommunityWorkspaceStartupFallback';
import { resolveWorkspaceCallDetails } from './resolveWorkspaceCallDetails';
import {
  communitiesWithCallVoicePresence,
  communityVoiceChannelTopologyKey,
} from './communityVoicePresence';
import {
  type ConversationThreadState,
  type EditingMessage,
  type MessageCollectionState,
  mergeConversationMessageIfTargetExists,
  mergeConversationThreadMessage,
  removeConversationThreadMessage,
} from './conversationThreadState';
import { conversationRealtimeTimelineMessageKind } from './conversationRealtimeTimelineMessage';
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
  notificationMentionContext,
  stableUniqueKey,
} from './workspaceNotificationState';
const seenCommunityMembershipRequests = new SeenCommunityMembershipRequests();

type LoadState = 'idle' | 'loading' | 'error';
type PendingSend = {
  attachmentUpload: AttachmentUploadOptions;
  attachments: File[];
  content: string;
  replyTarget: ChatMessage | null;
  sticker?: StickerMessageReference;
};
type FailedSends = Record<string, PendingSend>;
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
  peersLoading,
  peers,
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
  const [messageCollection, setMessageCollection] =
    useState<MessageCollectionState | null>(null);
  const [conversationThread, setConversationThread] =
    useState<ConversationThreadState | null>(null);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(
    null,
  );
  const [failedSends, setFailedSends] = useState<FailedSends>({});
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
    scrollMessagesToBottom,
    scrollerRef,
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
  const callSignalDeliveriesRef = useRef(new CallSignalDeliveryTracker());
  const reconcileCallResourceRef = useRef<(call: CallResource) => void>(
    () => undefined,
  );
  const sendQueueRef = useRef(Promise.resolve());
  const sessionRef = useRef(session);
  const suppressMessageLoadsUntilRef = useRef(0);
  const {
    activeCall,
    callMediaConnections,
    endCall,
    receiveSignal,
    reconcileCall,
    setParticipantScreenShareVolume,
    setParticipantVolume,
    setScreenShareQuality,
    startCall,
    toggleCamera,
    toggleDeafen,
    toggleMute,
    toggleNoiseCancellation,
    retryMicrophone,
    toggleScreenShare,
  } = useCallSession();
  const {
    noiseCancellationEnabled: callNoiseCancellationEnabled,
    requestOptionalLocalAudio,
    stopLocalAudio,
    toggleCallNoiseCancellation,
  } = useCallMediaAccess({
    identityId: session.identity.id,
    onError: setSendError,
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

    const request = applicationContainer
      .listCalls(sessionRef.current)
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
      void applicationContainer
        .listMessagePins(session, activeConversation.id)
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

    void applicationContainer
      .listConversationDrafts(session)
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
          void applicationContainer
            .saveConversationDraft(session, conversationId, value)
            .catch(() => undefined);

          return;
        }

        void applicationContainer
          .deleteConversationDraft(session, conversationId)
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
  const { incomingCall, reconcileCallResource, setIncomingCall } =
    useCallResourceReconciliation({
      activeCall,
      callDetailsForResource,
      currentIdentityId: session.identity.id,
      endCall,
      reconcileCall,
      setCommunities,
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
        await applicationContainer.sendCallSignal(sessionRef.current, callId, {
          payload,
          recipientIdentityId,
          signalType,
        });
      },
    [],
  );
  const loadCallIceConfig = useCallback(async () => {
    try {
      return await applicationContainer.getCallIceServers(sessionRef.current);
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
      const call = await applicationContainer.heartbeatCallParticipant(
        sessionRef.current,
        callId,
        mediaConnections,
      );

      reconcileCallResourceRef.current(call);
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
              applicationContainer
                .leaveCall(sessionRef.current, call.id)
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
    const next = await applicationContainer.listConversations(session);

    setConversations(next);

    return next;
  }, [session, setConversations]);

  const refreshSession = useCallback(async () => {
    const result = await applicationContainer.refreshSession(session);

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
      void applicationContainer
        .markConversationReadUntil(
          sessionRef.current,
          conversationId,
          lastMessage.id,
        )
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
        const result = await applicationContainer.loadMessages(
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

  const handleLoadOlder = async () => {
    keepMessageBottomUntilRef.current = 0;

    if (
      workspaceMode !== 'messages' ||
      !activeConversation?.id ||
      !activeConversationKey ||
      !messageCursorRef.current ||
      messageStateRef.current === 'loading' ||
      Date.now() < suppressMessageLoadsUntilRef.current
    )
      return;

    const requestedCursor = messageCursorRef.current;
    const requestId = messageRequestRef.current + 1;

    messageRequestRef.current = requestId;
    const scroller = scrollerRef.current;
    const anchor = scroller ? MessageScrollAnchor.capture(scroller) : null;
    const previousHeight = scroller?.scrollHeight ?? 0;
    const previousTop = scroller?.scrollTop ?? 0;
    const restorePreviousViewport = () => {
      if (!scroller || scrollerRef.current !== scroller) return;

      const nextTop = MessageScrollAnchor.restoreOrPreserveOffset(
        scroller,
        anchor,
        previousHeight,
        previousTop,
      );

      lastScrollTopRef.current = nextTop;
    };

    messageScrollAnchorRef.current = anchor;
    setMessageLoadState('loading');
    requestAnimationFrame(restorePreviousViewport);
    try {
      const result = await applicationContainer.loadMessages(
        sessionRef.current,
        activeConversation.id,
        requestedCursor,
      );

      if (messageRequestRef.current !== requestId) return;

      const hasNewMessages = MessageCollection.hasUnknownMessages(
        messagesRef.current,
        result.messages,
      );
      const nextCursor = result.nextCursor ?? null;

      if (hasNewMessages) {
        setMessages((current) =>
          MessageCollection.merge(current, result.messages),
        );
      }

      updateMessageCursor(
        hasNewMessages && nextCursor !== requestedCursor ? nextCursor : null,
      );
      requestAnimationFrame(() => {
        restorePreviousViewport();
        messageScrollAnchorRef.current = null;
      });
    } catch (caught) {
      messageScrollAnchorRef.current = null;
      setSendError(toUserErrorMessage(caught, copy.workspace.loadOlderError));
    }

    if (messageRequestRef.current !== requestId) return;

    setMessageLoadState('idle');
  };

  const handleScroll = () => {
    if (workspaceMode !== 'messages') return;

    const scrollTop = scrollerRef.current?.scrollTop ?? 0;
    const isScrollingUp = scrollTop < lastScrollTopRef.current;

    lastScrollTopRef.current = scrollTop;

    if (Date.now() < suppressMessageLoadsUntilRef.current) return;

    if (isScrolledNearBottom()) {
      setNewMessageCount(0);
    } else {
      keepMessageBottomUntilRef.current = 0;
      messageScrollAnchorRef.current = null;
    }

    if (isScrollingUp) {
      keepMessageBottomUntilRef.current = 0;
      messageScrollAnchorRef.current = null;
    }

    if (isScrollingUp && scrollTop < 80) void handleLoadOlder();
  };

  const sendPendingMessage = (payload: PendingSend) => {
    if (!activeConversation?.id) return;
    const conversationId = activeConversation.id;
    const conversationNetworkId = activeConversation.networkId;
    const optimisticTimestamp = Date.now();
    const optimisticId = `pending:${conversationId}:${optimisticTimestamp}:${UUID.generate().toString()}`;

    setSendError(null);
    setAttachmentProgress(null);
    setConversations((current) =>
      ConversationTimeline.bumpActivity(
        current,
        conversationId,
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
        attachments: PendingMessageAttachments.fromFiles(
          payload.attachments,
          optimisticId,
        ),
        authorIdentityId: session.identity.id,
        content: payload.sticker
          ? ''
          : payload.content ||
            payload.attachments.map((attachment) => attachment.name).join(', '),
        deliveryStatus: 'pending',
        encrypted: false,
        id: optimisticId,
        mine: true,
        raw: { id: optimisticId, type: 'sent' },
        reactions: [],
        replyPreview: replyPreviewFromMessage(payload.replyTarget),
        replyToMessageId: payload.replyTarget?.id,
        sticker: payload.sticker,
        timestamp: optimisticTimestamp,
      },
    ]);
    scrollMessagesToBottom('smooth');

    sendQueueRef.current = sendQueueRef.current.then(async () => {
      try {
        const lastMessageId = MessageCollection.lastDeliveredMessageTarget(
          messagesRef.current,
        )?.id;
        const sent = await applicationContainer.sendMessage(
          session,
          conversationId,
          payload.content,
          {
            attachments: payload.attachments,
            attachmentUpload: {
              ...payload.attachmentUpload,
              networkId: conversationNetworkId,
            },
            onAttachmentProgress: (progress) => {
              startTransition(() => {
                setMessages((current) =>
                  current.map((message) =>
                    message.id === optimisticId
                      ? { ...message, attachmentProgress: progress }
                      : message,
                  ),
                );
              });
            },
            previousMessageIds: lastMessageId ? [lastMessageId] : [],
            replyPreview: replyPreviewFromMessage(payload.replyTarget),
            replyToMessageId: payload.replyTarget?.id,
            sticker: payload.sticker,
          },
        );

        if (payload.sticker) {
          void applicationContainer.stickers.markUsed(session, payload.sticker);
        }

        setMessages((current) =>
          MessageCollection.merge(
            current.filter((message) => message.id !== optimisticId),
            [sent],
          ),
        );
        setConversations((current) =>
          ConversationTimeline.bumpActivity(
            current,
            conversationId,
            sent.timestamp,
          ),
        );
        scrollMessagesToBottom('smooth');
      } catch (caught) {
        setSendError(toUserErrorMessage(caught, copy.workspace.sendError));
        setFailedSends((current) => ({ ...current, [optimisticId]: payload }));
        setMessages((current) =>
          current.map((message) =>
            message.id === optimisticId
              ? {
                  ...message,
                  attachmentProgress: undefined,
                  deliveryStatus: 'failed',
                }
              : message,
          ),
        );
      }
    });
  };

  const handleSend = (
    content: string,
    attachments: File[],
    attachmentUpload: AttachmentUploadOptions,
  ): Promise<void> => {
    const payload = { attachmentUpload, attachments, content, replyTarget };

    setReplyTarget(null);
    sendPendingMessage(payload);

    return Promise.resolve();
  };
  const handleSendSticker = (
    sticker: StickerMessageReference,
  ): Promise<void> => {
    const payload = {
      attachmentUpload: {},
      attachments: [],
      content: '',
      replyTarget,
      sticker,
    };

    setReplyTarget(null);
    sendPendingMessage(payload);

    return Promise.resolve();
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
      const result = await applicationContainer.loadMessagesAround(
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

  const openMessageThread = async (message: ChatMessage) => {
    if (!activeConversation?.id) return;

    setMessageContextMenu(null);
    setConversationThread({
      draft: '',
      editingMessage: null,
      error: null,
      messages: [],
      replyTarget: null,
      root: message,
      state: 'loading',
    });
    try {
      const result = await applicationContainer.loadMessageThread(
        session,
        activeConversation.id,
        message.id,
      );

      setConversationThread({
        draft: '',
        editingMessage: null,
        error: null,
        messages: ThreadMessageVisibility.forRoot(
          message.id,
          ThreadMessageVisibility.markAsThreadMessages(
            message.id,
            result.messages,
          ),
        ),
        replyTarget: null,
        root: message,
        state: 'ready',
      });
    } catch (caught) {
      setConversationThread({
        draft: '',
        editingMessage: null,
        error: toUserErrorMessage(caught, copy.messages.threadError),
        messages: [],
        replyTarget: null,
        root: message,
        state: 'ready',
      });
    }
  };

  const openPinnedMessages = async () => {
    if (!activeConversation?.id) return;

    setMessageCollection({
      error: null,
      messages: [],
      state: 'loading',
    });
    try {
      const pins = await applicationContainer.listMessagePins(
        session,
        activeConversation.id,
      );

      setPinnedMessageIds(new Set(pins.map((pin) => pin.messageId)));
      setMessageCollection({
        error: null,
        messages: pins.map((pin) => pin.message),
        state: 'ready',
      });
    } catch (caught) {
      setMessageCollection({
        error: toUserErrorMessage(caught, copy.messages.pinError),
        messages: [],
        state: 'ready',
      });
    }
  };

  const pinMessage = async (message: ChatMessage) => {
    if (!activeConversation?.id) return;

    setMessageContextMenu(null);
    setSendError(null);
    try {
      await applicationContainer.pinMessage(
        session,
        activeConversation.id,
        message.id,
      );
      setPinnedMessageIds((current) => new Set(current).add(message.id));
    } catch (caught) {
      setSendError(toUserErrorMessage(caught, copy.messages.pinError));
    }
  };

  const unpinMessageFromDialog = async (message: ChatMessage) => {
    if (!activeConversation?.id) return;

    try {
      await applicationContainer.unpinMessage(
        session,
        activeConversation.id,
        message.id,
      );
      setPinnedMessageIds((current) => {
        const next = new Set(current);

        next.delete(message.id);

        return next;
      });
      setMessageCollection((current) =>
        current
          ? {
              ...current,
              messages: current.messages.filter(
                (item) => item.id !== message.id,
              ),
            }
          : current,
      );
    } catch (caught) {
      setMessageCollection((current) =>
        current
          ? {
              ...current,
              error: toUserErrorMessage(caught, copy.messages.unpinError),
            }
          : current,
      );
    }
  };

  const unpinMessage = async (message: ChatMessage) => {
    setMessageContextMenu(null);
    await unpinMessageFromDialog(message);
  };

  const updateConversationThreadDraft = (value: string) => {
    setConversationThread((current) =>
      current ? { ...current, draft: value } : current,
    );
  };

  const startEditingConversationThreadMessage = (message: ChatMessage) => {
    if (!activeConversation?.id) return;

    setMessageContextMenu(null);
    setConversationThread((current) =>
      current
        ? {
            ...current,
            draft: message.content,
            editingMessage: {
              message,
              previousDraft: current.draft,
            },
            replyTarget: null,
          }
        : current,
    );
  };

  const cancelConversationThreadEdit = () => {
    setConversationThread((current) =>
      current
        ? {
            ...current,
            draft: current.editingMessage?.previousDraft ?? '',
            editingMessage: null,
          }
        : current,
    );
  };
  const startReplyingToConversationThreadMessage = (message: ChatMessage) => {
    setMessageContextMenu(null);
    setConversationThread((current) =>
      current
        ? {
            ...current,
            editingMessage: null,
            replyTarget: message,
          }
        : current,
    );
  };
  const cancelConversationThreadReply = () => {
    setConversationThread((current) =>
      current ? { ...current, replyTarget: null } : current,
    );
  };

  const handleEditConversationThreadMessage = async (content: string) => {
    if (!activeConversation?.id || !conversationThread?.editingMessage) return;

    const targetMessage = conversationThread.editingMessage.message;

    setConversationThread((current) =>
      current ? { ...current, error: null } : current,
    );
    try {
      const editEvent = await applicationContainer.editMessage(
        session,
        activeConversation.id,
        targetMessage.id,
        content,
      );

      setMessages((current) =>
        mergeConversationMessageIfTargetExists(current, editEvent),
      );
      setConversationThread((current) =>
        current
          ? {
              ...mergeConversationThreadMessage(current, editEvent),
              draft: '',
              editingMessage: null,
              error: null,
              replyTarget: null,
            }
          : current,
      );
    } catch (caught) {
      setConversationThread((current) =>
        current
          ? {
              ...current,
              error: toUserErrorMessage(caught, copy.messages.editError),
            }
          : current,
      );
    }
  };

  const handleDeleteConversationThreadMessage = async (
    message: ChatMessage,
  ) => {
    if (!activeConversation?.id) return;

    setMessageContextMenu(null);
    setConversationThread((current) =>
      current ? { ...current, error: null } : current,
    );
    try {
      await applicationContainer.deleteMessage(
        session,
        activeConversation.id,
        message.id,
      );
      setMessages((current) =>
        current.filter((item) => item.id !== message.id),
      );
      setConversationThread((current) => {
        if (!current) return current;

        return removeConversationThreadMessage(current, message.id);
      });
    } catch (caught) {
      setConversationThread((current) =>
        current
          ? {
              ...current,
              error: toUserErrorMessage(caught, copy.messages.deleteError),
            }
          : current,
      );
    }
  };

  const sendConversationThreadMessage = async (
    content: string,
    attachments: File[],
    attachmentUpload: AttachmentUploadOptions,
  ) => {
    if (!activeConversation?.id || !conversationThread) return;

    const rootMessage = conversationThread.root;
    const sent = await applicationContainer.sendMessage(
      session,
      activeConversation.id,
      content,
      {
        attachments,
        attachmentUpload: {
          ...attachmentUpload,
          networkId: activeConversation.networkId,
        },
        previousMessageIds:
          conversationThread.messages.length > 0
            ? [
                conversationThread.messages[
                  conversationThread.messages.length - 1
                ].id,
              ]
            : [rootMessage.id],
        replyPreview: replyPreviewFromMessage(conversationThread.replyTarget),
        replyToMessageId: rootMessage.id,
        threadRootMessageId: rootMessage.id,
      },
    );

    setConversationThread((current) =>
      current
        ? {
            ...current,
            draft: '',
            messages: MessageCollection.merge(current.messages, [sent]),
            replyTarget: null,
          }
        : current,
    );
  };

  const sendConversationThreadSticker = async (
    sticker: StickerMessageReference,
  ) => {
    if (!activeConversation?.id || !conversationThread) return;

    const rootMessage = conversationThread.root;
    const sent = await applicationContainer.sendMessage(
      session,
      activeConversation.id,
      '',
      {
        previousMessageIds:
          conversationThread.messages.length > 0
            ? [
                conversationThread.messages[
                  conversationThread.messages.length - 1
                ].id,
              ]
            : [rootMessage.id],
        replyPreview: replyPreviewFromMessage(conversationThread.replyTarget),
        replyToMessageId: rootMessage.id,
        sticker,
        threadRootMessageId: rootMessage.id,
      },
    );

    void applicationContainer.stickers.markUsed(session, sticker);
    setConversationThread((current) =>
      current
        ? {
            ...current,
            draft: '',
            messages: MessageCollection.merge(current.messages, [sent]),
            replyTarget: null,
          }
        : current,
    );
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!activeConversation?.id) return;

    setMessageContextMenu(null);
    setSendError(null);
    try {
      await applicationContainer.deleteMessage(
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
      const editEvent = await applicationContainer.editMessage(
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
          ? MessageReactions.update(
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
        await applicationContainer.removeMessageReaction(
          session,
          conversationId,
          message.id,
          emoji,
        );
      } else {
        await applicationContainer.addMessageReaction(
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
            ? MessageReactions.update(
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

      const sharedNetworkId = SharedNetworkSelection.select(
        session.identity.networks,
        identity?.networks,
        preferredNetworkId,
      );

      if (!sharedNetworkId) throw new Error(copy.dialog.noSharedNetwork);

      const result = await applicationContainer.createConversation(
        sessionRef.current,
        identityId,
        sharedNetworkId,
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
    const result = await applicationContainer.identities.publishKeychain(session, {
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

  const applyRealtimeConversationMessage = useCallback(
    (
      conversationId: string,
      message: ChatMessage,
      shouldAutoScroll: boolean,
    ) => {
      const isEditMessage = message.raw.type === 'edited';
      const isThreadReply = ThreadMessageVisibility.isThreadMessage(message);

      if (isThreadReply || isEditMessage) {
        setConversationThread((current) =>
          current ? mergeConversationThreadMessage(current, message) : current,
        );
      }

      if (!isThreadReply) {
        setMessages((current) =>
          isEditMessage
            ? mergeConversationMessageIfTargetExists(current, message)
            : MessageCollection.merge(current, [message]),
        );
      }

      if (shouldAutoScroll) {
        markConversationReadUntil(conversationId, [message]);
        if (!isThreadReply) scrollMessagesToBottom('smooth', true);
      } else if (!isEditMessage && !isThreadReply) {
        const setting = NotificationSettingsPolicy.resolve(
          notificationSettingsRef.current,
          {
            conversationId,
            type: 'conversation',
          },
        );

        if (!NotificationSettingsPolicy.isMuted(setting)) {
          setNewMessageCount((current) => current + 1);
        }
      }
    },
    [markConversationReadUntil, scrollMessagesToBottom],
  );
  const fetchRealtimeMessage = useCallback(
    async (
      conversationId: string,
      messageId: string,
      shouldAutoScroll: boolean,
    ) => {
      try {
        const message = await applicationContainer.loadMessage(
          session,
          conversationId,
          messageId,
        );

        if (!message) return;

        applyRealtimeConversationMessage(
          conversationId,
          message,
          shouldAutoScroll,
        );
      } catch (caught) {
        setSendError(
          toUserErrorMessage(caught, copy.workspace.loadMessagesError),
        );
      }
    },
    [applyRealtimeConversationMessage, session],
  );
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
  const handleRealtimeEvent = useCallback(
    (event: RealtimeDomainEvent) => {
      // eslint-disable-next-line no-console
      console.debug('[pigeon realtime] domain_event', event.type, event);

      if (realtimeEventsOpen) {
        setRealtimeEventLog((current) => {
          if (current.some((item) => item.event_id === event.event_id)) {
            return current;
          }

          return [...current.slice(-99), event];
        });
      }

      const presence = presenceFromRealtimeEvent(event);

      if (presence) {
        mergePresence(presence);

        return;
      }

      if (event.type === 'identities.v1.identity.was_updated') {
        const identityId =
          eventAggregateId(event) ?? stringAttribute(event, 'identityId', 'id');

        if (identityId) {
          void applicationContainer
            .identities.refresh(IdentityId.normalize(identityId))
            .then(rememberIdentity)
            .catch(() => undefined);
        }

        return;
      }

      if (event.type.startsWith('calls.')) {
        const eventCallId = callIdFromRealtimeEvent(event);

        logCallDebug('workspace:realtime-call-event', {
          activeCallId: activeCallRef.current?.id,
          callId: eventCallId,
          eventType: event.type,
        });

        if (event.type === 'calls.v1.signal.sent') {
          const callId = eventCallId;
          const senderIdentityId = stringAttribute(event, 'senderIdentityId');
          const recipientIdentityId = stringAttribute(
            event,
            'recipientIdentityId',
          );
          const signalType = callSignalTypeAttribute(event);
          const payload = recordAttribute(event, 'payload');
          const expiresAt = numberAttribute(event, 'expiresAt');
          const signalId = stringAttribute(event, 'signalId');

          if (
            callId &&
            senderIdentityId &&
            recipientIdentityId === session.identity.id &&
            signalType &&
            payload &&
            expiresAt !== undefined &&
            signalId
          ) {
            void callSignalDeliveriesRef.current
              .receive(
                { expiresAt, signalId },
                async () =>
                  await receiveSignal({
                    callId,
                    payload,
                    senderIdentityId,
                    signalType,
                  }),
                () => acknowledgeRealtimeCallSignal(session, signalId),
              )
              .catch(() => undefined);
          }

          return;
        }

        const callId = eventCallId;

        if (!callId) return;

        void applicationContainer
          .getCall(sessionRef.current, callId)
          .then((call) => {
            logCallDebug('workspace:realtime-call-event:resource-loaded', {
              activeCallId: activeCallRef.current?.id,
              callId: call.id,
              participantStatuses: call.participants.map((participant) => ({
                connected: participant.connected,
                identityId: participant.identityId,
                status: participant.status,
              })),
              status: call.status,
            });
            reconcileCallResource(call);
          })
          .catch((caught) => {
            logCallError(
              'workspace:realtime-call-event:resource-load-failed',
              caught,
              {
                callId,
                eventType: event.type,
              },
            );
          });

        return;
      }

      if (event.type.startsWith('nodes.')) {
        if (event.type === 'nodes.v1.node.network.was_removed') {
          const removedNetworkId = stringAttribute(event, 'networkId');

          if (removedNetworkId) {
            setConversations((current) =>
              current.filter(
                (conversation) => conversation.networkId !== removedNetworkId,
              ),
            );
            setCommunities((current) =>
              current.filter(
                (community) => community.networkId !== removedNetworkId,
              ),
            );

            if (activeConversation?.networkId === removedNetworkId) {
              setActiveConversationId(null);
              setMessages([]);
              updateMessageCursor(null);
            }

            if (activeCommunity?.networkId === removedNetworkId) {
              setActiveCommunityId(null);
            }
          }

          void onNodeNetworksReload().catch(() => undefined);
        }

        void onPeersReload().catch(() => undefined);

        return;
      }

      if (event.type.startsWith('notifications.')) {
        playNotificationSoundIfAllowed();
        void showPwaNotification({
          body: copy.notifications.open,
          tag: `notification-${event.event_id}`,
          title: copy.notifications.title,
        });
        void refreshNotifications();

        return;
      }

      if (event.type.startsWith('keychains.')) {
        void refreshSession().catch(() => undefined);

        return;
      }

      if (event.type.startsWith('polls.v1.')) {
        const poll = recordAttribute(event, 'poll') as PollResource | undefined;
        const scopeType = poll?.scope.type;
        const participantIds = event.attributes.participantIds;
        const memberIds = event.attributes.memberIds;

        if (
          scopeType === 'group_conversation' ||
          Array.isArray(participantIds)
        ) {
          setConversationRealtimeEvent(event);

          return;
        }

        if (scopeType === 'community_channel' || Array.isArray(memberIds)) {
          setCommunityRealtimeEvent(event);

          return;
        }
      }

      if (event.type.startsWith('identities.')) {
        if (event.aggregate_id === session.identity.id) {
          void applicationContainer
            .identities.get(session.identity.id)
            .then((identity) => setSession({ ...session, identity }))
            .catch(() => undefined);
        }

        return;
      }

      if (event.type.startsWith('communities.v1.membership_request.')) {
        void refreshMembershipRequests();

        if (event.type === 'communities.v1.membership_request.was_accepted') {
          void onCommunitiesReload();
        }

        return;
      }

      if (event.type === 'communities.v1.channel.message.was_sent') {
        const communityId =
          eventAggregateId(event) ?? stringAttribute(event, 'communityId');
        const channelId = stringAttribute(event, 'channelId');
        const authorIdentityId = stringAttribute(event, 'authorIdentityId');
        const timelineMessage = recordAttribute(event, 'message') as
          | MessageResource
          | undefined;
        const pageVisible = isBrowserPageVisible();
        const eventCommunity = communityId
          ? communities.find((community) => community.id === communityId)
          : undefined;
        const notificationSetting =
          communityId && channelId
            ? NotificationSettingsPolicy.resolve(
                notificationSettingsRef.current,
                {
                  channelId,
                  communityId,
                  type: 'community_channel',
                },
              )
            : null;
        const notificationAllowed =
          notificationSetting && eventCommunity
            ? NotificationSettingsPolicy.shouldNotify(
                notificationSetting,
                notificationMentionContext({
                  currentIdentityId: session.identity.id,
                  currentRoleIds: [
                    ...CommunityAccessPolicy.assignedRoleIdsFor(
                      eventCommunity,
                      session.identity.id,
                    ),
                  ],
                  event,
                }),
              )
            : false;
        const isActiveChannel =
          pageVisible &&
          workspaceMode === 'community' &&
          communityId === activeCommunity?.id &&
          channelId === activeCommunityChannelId;

        if (
          communityId &&
          channelId &&
          !isActiveChannel &&
          notificationAllowed &&
          authorIdentityId !== session.identity.id
        ) {
          const preview = communityNotificationPreview(
            communities,
            communityId,
            channelId,
            authorIdentityId,
            identityNames,
            timelineMessage,
          );

          playNotificationSoundIfAllowed();
          void showPwaNotification({
            body: preview.body,
            tag: `community-${communityId}-${channelId}`,
            title: preview.title,
          });
          markCommunityChannelUnread(communityId, channelId);
        }

        setCommunityRealtimeEvent(event);

        return;
      }

      if (
        event.type === 'communities.v1.channel.message.was_deleted' ||
        event.type === 'communities.v1.channel.message.was_pinned' ||
        event.type === 'communities.v1.channel.message.was_unpinned' ||
        event.type === 'communities.v1.channel.message.reaction.was_added' ||
        event.type === 'communities.v1.channel.message.reaction.was_removed' ||
        event.type === 'communities.v1.call.event.was_recorded'
      ) {
        setCommunityRealtimeEvent(event);

        return;
      }

      if (event.type === 'communities.v1.channel.was_created') {
        const communityId =
          eventAggregateId(event) ?? stringAttribute(event, 'communityId');
        const channel = communityChannelAttribute(event, 'channel');

        if (communityId && channel) {
          updateCommunityState(communityId, (community) => {
            if (CommunityChannels.has(community, channel.id)) {
              return community;
            }

            return channel.type === 'voice'
              ? {
                  ...community,
                  voiceChannels: [...(community.voiceChannels ?? []), channel],
                }
              : {
                  ...community,
                  textChannels: [...community.textChannels, channel],
                };
          });
        }

        return;
      }

      if (event.type === 'communities.v1.channel.was_renamed') {
        const communityId =
          eventAggregateId(event) ?? stringAttribute(event, 'communityId');
        const channelId = stringAttribute(event, 'channelId');
        const name = stringAttribute(event, 'name');

        if (communityId && channelId && name) {
          updateCommunityState(communityId, (community) => ({
            ...community,
            textChannels: community.textChannels.map((channel) =>
              channel.id === channelId ? { ...channel, name } : channel,
            ),
            voiceChannels: (community.voiceChannels ?? []).map((channel) =>
              channel.id === channelId ? { ...channel, name } : channel,
            ),
          }));
        }

        return;
      }

      if (event.type === 'communities.v1.channel.was_deleted') {
        const communityId =
          eventAggregateId(event) ?? stringAttribute(event, 'communityId');
        const channelId = stringAttribute(event, 'channelId');

        if (communityId && channelId) {
          updateCommunityState(communityId, (community) => ({
            ...community,
            textChannels: community.textChannels.filter(
              (channel) => channel.id !== channelId,
            ),
            voiceChannels: (community.voiceChannels ?? []).filter(
              (channel) => channel.id !== channelId,
            ),
          }));
        }

        return;
      }

      if (event.type === 'communities.v1.community.was_updated') {
        const community = communityAttribute(event, 'community');

        if (community) {
          setCommunities((current) =>
            current.map((item) =>
              item.id === community.id ? community : item,
            ),
          );
        }

        return;
      }

      if (event.type === 'communities.v1.member.was_added') {
        const community = communityAttribute(event, 'community');
        const communityId =
          community?.id ??
          eventAggregateId(event) ??
          stringAttribute(event, 'communityId');
        const identityId = stringAttribute(event, 'identityId');

        if (community) {
          setCommunities((current) =>
            current.map((item) =>
              item.id === community.id ? community : item,
            ),
          );
        } else if (communityId && identityId) {
          updateCommunityState(communityId, (current) =>
            current.memberIds.includes(identityId)
              ? current
              : { ...current, memberIds: [...current.memberIds, identityId] },
          );
        }

        return;
      }

      if (event.type === 'communities.v1.member.was_left') {
        const community = communityAttribute(event, 'community');
        const communityId =
          community?.id ??
          eventAggregateId(event) ??
          stringAttribute(event, 'communityId');
        const identityId = stringAttribute(event, 'identityId');

        if (identityId === session.identity.id && communityId) {
          setCommunities((current) =>
            current.filter((item) => item.id !== communityId),
          );

          return;
        }

        if (community) {
          setCommunities((current) =>
            current.map((item) =>
              item.id === community.id ? community : item,
            ),
          );
        } else if (communityId && identityId) {
          updateCommunityState(communityId, (current) => ({
            ...current,
            memberIds: current.memberIds.filter((id) => id !== identityId),
          }));
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

      if (
        event.type.startsWith('conversations.v1.message.') ||
        event.type === 'conversations.v1.call.event.was_recorded'
      ) {
        void refreshConversations().catch(() => undefined);
        const conversationId = eventAggregateId(event);
        const messageId = stringAttribute(event, 'messageId', 'message_id');
        const timelineMessage = recordAttribute(event, 'message') as
          | MessageResource
          | undefined;
        const authorId = stringAttribute(event, 'authorId', 'author_id');
        const isReactionEvent =
          event.type === 'conversations.v1.message.reaction.was_added' ||
          event.type === 'conversations.v1.message.reaction.was_removed';
        const isEditEvent =
          event.type === 'conversations.v1.message.was_edited';
        const isPinEvent =
          event.type === 'conversations.v1.message.was_pinned' ||
          event.type === 'conversations.v1.message.was_unpinned';
        const isSelectedConversation =
          workspaceMode === 'messages' &&
          !!conversationId &&
          conversationId === activeConversation?.id;
        const isActiveConversation =
          isSelectedConversation && isBrowserPageVisible();
        const notificationSetting = conversationId
          ? NotificationSettingsPolicy.resolve(
              notificationSettingsRef.current,
              {
                conversationId,
                type: 'conversation',
              },
            )
          : null;
        const notificationAllowed = notificationSetting
          ? NotificationSettingsPolicy.shouldNotify(
              notificationSetting,
              notificationMentionContext({
                currentIdentityId: session.identity.id,
                event,
                message: timelineMessage,
              }),
            )
          : false;

        if ((!messageId && !timelineMessage) || !conversationId) return;

        setConversations((current) =>
          ConversationTimeline.bumpActivity(
            current,
            conversationId,
            event.occurred_on,
          ),
        );

        if (
          !isActiveConversation &&
          !isReactionEvent &&
          !isEditEvent &&
          !isPinEvent &&
          notificationAllowed &&
          authorId !== session.identity.id &&
          timelineMessage?.actorIdentityId !== session.identity.id
        ) {
          const unreadMessageId = messageId ?? timelineMessage?.id;
          const preview = conversationNotificationPreview(
            conversations,
            conversationId,
            session,
            identityNames,
            identityProfiles,
            timelineMessage,
          );

          playNotificationSoundIfAllowed();
          void showPwaNotification({
            body: preview.body,
            tag: `conversation:${conversationId}`,
            title: preview.title,
          });

          if (unreadMessageId)
            markUnreadMessage(conversationId, unreadMessageId);
        }

        if (isSelectedConversation) {
          if (isActiveConversation) {
            clearUnreadMessages(conversationId);
          }

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
              setConversationThread((current) =>
                current
                  ? removeConversationThreadMessage(current, targetMessageId)
                  : current,
              );
            }

            return;
          }

          if (isReactionEvent && messageId) {
            const reactionAuthorId = stringAttribute(
              event,
              'authorId',
              'authorIdentityId',
              'author_id',
            );
            const emoji = stringAttribute(event, 'emoji');

            if (!reactionAuthorId || !emoji) return;

            setMessages((current) =>
              current.map((message) =>
                message.id === messageId
                  ? MessageReactions.update(
                      message,
                      reactionAuthorId,
                      emoji,
                      event.type.endsWith('.was_added') ? 'add' : 'remove',
                      typeof event.attributes.createdAt === 'number'
                        ? event.attributes.createdAt
                        : event.occurred_on,
                    )
                  : message,
              ),
            );

            return;
          }

          if (isPinEvent && messageId) {
            setPinnedMessageIds((current) => {
              const next = new Set(current);

              if (event.type.endsWith('.was_pinned')) {
                next.add(messageId);
              } else {
                next.delete(messageId);
              }

              return next;
            });

            return;
          }

          if (timelineMessage) {
            const shouldAutoScroll = isScrolledNearBottom();

            if (
              conversationRealtimeTimelineMessageKind(event.type) ===
              'call-event'
            ) {
              const message: ChatMessage = {
                attachments: [],
                authorIdentityId:
                  timelineMessage.actorIdentityId ??
                  timelineMessage.authorIdentityId ??
                  'system',
                content: '',
                encrypted: false,
                id: timelineMessage.id ?? `${event.event_id}:call-event`,
                kind: 'call-event',
                mine: timelineMessage.actorIdentityId === session.identity.id,
                raw: timelineMessage,
                reactions: timelineMessage.reactions ?? [],
                timestamp: timelineMessage.createdAt ?? event.occurred_on,
              };

              setMessages((current) =>
                MessageCollection.merge(current, [message]),
              );

              if (shouldAutoScroll) scrollMessagesToBottom('smooth', true);

              return;
            }

            if (!activeConversationKeyId) return;

            void applicationContainer
              .decryptMessageResource(session, conversationId, timelineMessage)
              .then((message: ChatMessage) =>
                applyRealtimeConversationMessage(
                  conversationId,
                  message,
                  shouldAutoScroll,
                ),
              )
              .catch(() => {
                const fallbackMessageId = messageId ?? timelineMessage.id;

                if (!fallbackMessageId) return;

                void fetchRealtimeMessage(
                  conversationId,
                  fallbackMessageId,
                  shouldAutoScroll,
                );
              });

            return;
          }

          if (
            !activeConversationKeyId ||
            !messageId ||
            messagesRef.current.some((message) => message.id === messageId)
          ) {
            return;
          }

          void fetchRealtimeMessage(
            conversationId,
            messageId,
            isScrolledNearBottom(),
          );
        }
      }

      if (event.type === 'conversations.v1.messages.were_read') {
        const conversationId = eventAggregateId(event);
        const readerIdentityId = stringAttribute(
          event,
          'readerIdentityId',
          'reader_identity_id',
        );

        if (conversationId && readerIdentityId === session.identity.id) {
          clearUnreadMessages(conversationId);
          setConversations((current) =>
            current.map((conversation) =>
              conversation.id === conversationId
                ? { ...conversation, unreadCount: 0 }
                : conversation,
            ),
          );
        }
      }
    },
    [
      activeCommunity?.id,
      activeCommunity?.networkId,
      activeCommunityChannelId,
      activeConversation?.id,
      activeConversation?.networkId,
      activeConversationKeyId,
      applyRealtimeConversationMessage,
      clearUnreadMessages,
      communities,
      conversations,
      fetchRealtimeMessage,
      identityNames,
      identityProfiles,
      isScrolledNearBottom,
      markCommunityChannelUnread,
      markUnreadMessage,
      mergePresence,
      onCommunitiesReload,
      onNodeNetworksReload,
      onPeersReload,
      playNotificationSoundIfAllowed,
      refreshConversations,
      refreshMembershipRequests,
      refreshNotifications,
      refreshSession,
      realtimeEventsOpen,
      receiveSignal,
      rememberIdentity,
      reconcileCallResource,
      session,
      setConversations,
      setCommunities,
      setSession,
      updateCommunityState,
      workspaceMode,
    ],
  );

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
        const result = await applicationContainer.leaveCommunity(
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
                    item.id === community.id ? community : item,
                  ),
                )
              }
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
                void applicationContainer
                  .getCommunity(sessionRef.current, request.communityId)
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
