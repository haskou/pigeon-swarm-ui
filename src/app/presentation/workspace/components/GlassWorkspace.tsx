import { UUID } from '@haskou/value-objects';
import {
  type Dispatch,
  type SetStateAction,
  lazy,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { NodeNetwork } from '../../../../modules/networks/application/list-node-networks/ListNodeNetworks';
import type { Peer } from '../../../../modules/networks/application/list-peers/ListPeers';
import type {
  CallParticipant,
  CallParticipantStatus,
  CallResource,
  CallSignalType,
  CallSession,
} from '../../../../modules/calls/domain/callSession.types';
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
  PollResource,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type {
  RealtimeDomainEvent,
  RealtimeTypingInput,
  RealtimeTypingMessage,
} from '../../../../shared/infrastructure/realtime/realtimeGateway';
import type { PendingCommunityInviteLink } from '../../../../modules/communities/presentation/view-models/communityInviteLink';
import type { MessageContextMenuState } from './messageContextMenu';

import { applicationContainer } from '../../../composition/applicationContainer';
import { PendingMessageAttachments } from '../../../../modules/attachments/domain/PendingMessageAttachments';
import { CommunityChannels } from '../../../../modules/communities/domain/CommunityChannels';
import { ConversationKeychain } from '../../../../modules/conversations/domain/ConversationKeychain';
import { ConversationTimeline } from '../../../../modules/conversations/domain/ConversationTimeline';
import { ConversationPeer } from '../../../../modules/conversations/domain/ConversationPeer';
import { MessageCollection } from '../../../../modules/messages/domain/MessageCollection';
import { replyPreviewFromMessage } from '../../../../modules/messages/presentation/view-models/replyPreviewFromMessage';
import { MessageReactions } from '../../../../modules/messages/domain/MessageReactions';
import { SharedNetworkSelection } from '../../../../modules/networks/domain/SharedNetworkSelection';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  logCallDebug,
  logCallError,
  logCallWarning,
} from '../../../../modules/calls/infrastructure/media/callDebugLogger';
import { CallMicrophoneCapture } from '../../../../modules/calls/infrastructure/media/CallMicrophoneCapture';
import { useCallSession } from '../../../../modules/calls/presentation/hooks/useCallSession';
import { SeenCommunityMembershipRequests } from '../../../../modules/communities/infrastructure/storage/SeenCommunityMembershipRequests';
import { useCommunityMembershipRequests } from '../../../../modules/communities/presentation/hooks/useCommunityMembershipRequests';
import { useIdentityDirectory } from '../../../../modules/identities/presentation/hooks/useIdentityDirectory';
import {
  sendRealtimeTyping,
  useRealtimeEvents,
} from '../../../../app/presentation/realtime/useRealtimeEvents';
import { useUnreadMessages } from '../../../../modules/messages/presentation/hooks/useUnreadMessages';
import {
  currentPwaNotificationPermission,
  deletePwaPushSubscription,
  ensurePwaPushSubscription,
  type PwaNotificationPermission,
  showPwaNotification,
} from '../../../../modules/notifications/infrastructure/browser/pwaNotifications';
import { useNotifications } from '../../../../modules/notifications/presentation/hooks/useNotifications';
import { useNotificationCommunityPreviews } from '../../../../modules/notifications/presentation/hooks/useNotificationCommunityPreviews';
import {
  communityNotificationPreview,
  conversationNotificationPreview,
} from '../../../../modules/notifications/presentation/view-models/notificationPreviews';
import { presenceFromRealtimeEvent } from '../presenceFromRealtimeEvent';
import {
  activeTypingIdentityIds,
  communityTypingKey,
  expireTypingEntries,
  type TypingEntries,
  typingInputKey,
  updateTypingEntries,
} from '../typingEntries';
import {
  useWorkspacePreferences,
  useWorkspacePreferenceState,
} from '../useWorkspacePreferences';
import { writeJsonToLocalStorage } from '../../../../shared/infrastructure/storage/jsonLocalStorage';
import { cx } from '../../../../shared/presentation/cx';
import {
  playAnsweredCallSound,
  playEndedCallSound,
  playIncomingCallSound,
  playNotificationSound,
  stopIncomingCallSound,
} from '../../../../shared/presentation/sounds';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { CommunityWorkspace } from '../../../../modules/communities/presentation/components/CommunityWorkspace';
import {
  PushNotificationPrompt,
  type PushNotificationPromptState,
} from './PushNotificationPrompt';
import { Rail } from './Rail';
import { isBrowserPageVisible } from './isBrowserPageVisible';
import { useCommunitySelection } from './useCommunitySelection';
import { usePendingCommunityInvite } from './usePendingCommunityInvite';
import { useSidebarGesture } from './useSidebarGesture';
import { useWorkspaceCallHeartbeat } from './useWorkspaceCallHeartbeat';
import { useWorkspacePresence } from './useWorkspacePresence';
import { useWorkspaceResumeSync } from './useWorkspaceResumeSync';
import {
  callSignalTypeAttribute,
  communityAttribute,
  communityChannelAttribute,
  eventAggregateId,
  recordAttribute,
  stringAttribute,
} from './realtimeEventAttributes';
import { ChatColumn } from './ChatColumn';
import {
  callAudioStorageKey,
  loadCallNoiseCancellationEnabled,
} from './workspacePersistence';
import { resolveWorkspaceCallDetails } from './resolveWorkspaceCallDetails';

const Inspector = lazy(() =>
  import('./Inspector').then((module) => ({
    default: module.Inspector,
  })),
);
const Sidebar = lazy(() =>
  import('./Sidebar').then((module) => ({
    default: module.Sidebar,
  })),
);
const WorkspaceDialogs = lazy(() =>
  import('./WorkspaceDialogs').then((module) => ({
    default: module.WorkspaceDialogs,
  })),
);
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
type EditingMessage = {
  message: ChatMessage;
  previousDraft: string;
};

function stableUniqueKey(values: string[]): string {
  return [...new Set(values.filter(Boolean))].sort().join('\u0000');
}

function canActOnMembershipRequest(
  request: CommunityMembershipRequest,
  communities: Community[],
  currentIdentityId: string,
): boolean {
  if (request.status !== 'pending') return false;

  if (request.type === 'invitation') {
    return request.identityId === currentIdentityId;
  }

  return communities.some(
    (community) =>
      community.id === request.communityId &&
      community.ownerIdentityId === currentIdentityId,
  );
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
  onPendingCommunityInviteHandled?: () => void;
  pendingCommunityInvite?: PendingCommunityInviteLink | null;
  peers: Peer[];
  setCommunities: Dispatch<SetStateAction<Community[]>>;
  setConversations: Dispatch<SetStateAction<ConversationResource[]>>;
}

export function GlassWorkspace({
  communities,
  conversations,
  node,
  nodeNetworks,
  onCommunitiesReload,
  onNodeNetworksReload,
  onPeersReload,
  onPendingCommunityInviteHandled,
  peers,
  pendingCommunityInvite,
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
    setActiveCommunityId,
    setActiveConversationId,
    setCommunityChannelById,
    setCommunityUnreadCountsById,
    setDrafts,
    setWorkspaceMode,
    workspaceMode,
  } = useWorkspacePreferenceState(conversations, session.identity.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<LoadState>('idle');
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
  const [conversationTypingEntries, setConversationTypingEntries] =
    useState<TypingEntries>({});
  const [communityTypingEntries, setCommunityTypingEntries] =
    useState<TypingEntries>({});
  const typingSentRef = useRef(
    new Map<string, { active: boolean; sentAt: number }>(),
  );
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentProgress, setAttachmentProgress] =
    useState<AttachmentProgress | null>(null);
  const [messageContextMenu, setMessageContextMenu] =
    useState<MessageContextMenuState | null>(null);
  const [rawMessage, setRawMessage] = useState<ChatMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(
    null,
  );
  const [failedSends, setFailedSends] = useState<FailedSends>({});
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [communityMembersOpen, setCommunityMembersOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    call: CallResource;
    caller?: CallParticipant;
    participants: CallParticipant[];
    title: string;
  } | null>(null);
  const [nodeSettingsOpen, setNodeSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenMembershipRequestIds, setSeenMembershipRequestIds] = useState<
    string[]
  >(() => seenCommunityMembershipRequests.get(session.identity.id));
  const [pushPermission, setPushPermission] =
    useState<PwaNotificationPermission>(() =>
      currentPwaNotificationPermission(),
    );
  const [pushEnableState, setPushEnableState] =
    useState<PushNotificationPromptState>('idle');
  const [pushEnableError, setPushEnableError] = useState<string | null>(null);
  const [pushPromptDismissed, setPushPromptDismissed] = useState(false);
  const [callNoiseCancellationEnabled, setCallNoiseCancellationEnabled] =
    useState(() => loadCallNoiseCancellationEnabled(session.identity.id));
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const keepMessageBottomUntilRef = useRef(0);
  const messageCursorRef = useRef<string | null>(null);
  const messageAbortRef = useRef<AbortController | null>(null);
  const messageRequestRef = useRef(0);
  const messageStateRef = useRef<LoadState>('idle');
  const messagesRef = useRef<ChatMessage[]>([]);
  const activeCallRef = useRef<CallSession | null>(null);
  const callActionInProgressRef = useRef(false);
  const callParticipantStatusesRef = useRef<
    Record<string, Record<string, CallParticipantStatus>>
  >({});
  const notifiedIncomingCallIdsRef = useRef(new Set<string>());
  const callStartupSyncIdentityRef = useRef<string | null>(null);
  const reconcileCallResourceRef = useRef<(call: CallResource) => void>(
    () => undefined,
  );
  const sendQueueRef = useRef(Promise.resolve());
  const sessionRef = useRef(session);
  const suppressMessageLoadsUntilRef = useRef(0);
  const {
    activeCall,
    endCall,
    receiveSignal,
    reconcileCall,
    setParticipantScreenShareVolume,
    setParticipantVolume,
    startCall,
    toggleCamera,
    toggleDeafen,
    toggleMute,
    toggleNoiseCancellation,
    toggleScreenShareAudio,
    toggleScreenShare,
  } = useCallSession();
  const {
    clearSidebarGesture,
    handleWorkspacePointerDown,
    handleWorkspacePointerMove,
  } = useSidebarGesture(sidebarOpen, setSidebarOpen);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    setSeenMembershipRequestIds(
      seenCommunityMembershipRequests.get(session.identity.id),
    );
  }, [session.identity.id]);

  useEffect(() => {
    setCallNoiseCancellationEnabled(
      loadCallNoiseCancellationEnabled(session.identity.id),
    );
  }, [session.identity.id]);

  useEffect(() => {
    writeJsonToLocalStorage(callAudioStorageKey(session.identity.id), {
      noiseCancellationEnabled: callNoiseCancellationEnabled,
    });
  }, [callNoiseCancellationEnabled, session.identity.id]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messageStateRef.current = messageState;
  }, [messageState]);

  useEffect(() => {
    if (!incomingCall) return undefined;

    playIncomingCallSound();

    return stopIncomingCallSound;
  }, [incomingCall?.call.id]);

  const setMessageLoadState = useCallback((state: LoadState) => {
    messageStateRef.current = state;
    setMessageState(state);
  }, []);
  const refreshPushPermission = useCallback(() => {
    setPushPermission(currentPwaNotificationPermission());
  }, []);
  const enablePushNotifications = useCallback(async () => {
    setPushEnableState('loading');
    setPushEnableError(null);

    try {
      await ensurePwaPushSubscription(session, { requestPermission: true });
      const nextPermission = currentPwaNotificationPermission();

      setPushPermission(nextPermission);

      if (nextPermission === 'denied') {
        setPushEnableState('error');
        setPushEnableError(copy.notifications.enablePushDenied);

        return;
      }

      setPushEnableState('idle');
      setPushEnableError(null);
    } catch (caught) {
      refreshPushPermission();
      setPushEnableState('error');
      setPushEnableError(
        toUserErrorMessage(caught, copy.notifications.enablePushError),
      );
    }
  }, [refreshPushPermission, session]);

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
  const activeConversationDraft = activeConversation?.id
    ? (drafts[activeConversation.id] ?? '')
    : '';
  const { activeCommunity, activeCommunityChannelId } = useCommunitySelection({
    activeCommunityId,
    communities,
    communityChannelById,
  });

  useWorkspacePreferences({
    activeCommunityId: activeCommunity?.id ?? activeCommunityId,
    activeConversationId: activeConversation?.id ?? activeConversationId,
    communityChannelById,
    communityUnreadCountsById,
    drafts,
    identityId: session.identity.id,
    workspaceMode,
  });

  const communityUnreadCounts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(communityUnreadCountsById).map(
          ([communityId, channels]) => [
            communityId,
            Object.values(channels).reduce((total, count) => total + count, 0),
          ],
        ),
      ) as Record<string, number>,
    [communityUnreadCountsById],
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

      setDrafts((current) => ({
        ...current,
        [activeConversation.id]: value,
      }));
    },
    [activeConversation?.id],
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
  const { clearUnreadMessages, conversationsWithUnread, markUnreadMessage } =
    useUnreadMessages(conversations);
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
      seenCommunityMembershipRequests.markSeen(
        session.identity.id,
        requestIds,
      ),
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

  useEffect(() => {
    void ensurePwaPushSubscription(session)
      .catch(() => undefined)
      .finally(refreshPushPermission);
  }, [refreshPushPermission, session]);

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
    messageAuthorIdentityIdsKey,
    notifications: notificationList,
    session,
  });
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
  const reconcileCallResource = useCallback(
    (call: CallResource) => {
      const details = callDetailsForResource(call);
      const currentParticipant = call.participants.find(
        (participant) => participant.identityId === session.identity.id,
      );
      const previousParticipantStatuses =
        callParticipantStatusesRef.current[call.id] ?? {};
      const nextParticipantStatuses = Object.fromEntries(
        call.participants.map((participant) => [
          participant.identityId,
          participant.status,
        ]),
      ) as Record<string, CallParticipantStatus>;
      const remoteParticipantLeftActiveCommunityVoice =
        call.scope.type === 'community_channel' &&
        activeCallRef.current?.id === call.id &&
        call.status === 'active' &&
        call.participants.some(
          (participant) =>
            participant.identityId !== session.identity.id &&
            previousParticipantStatuses[participant.identityId] === 'joined' &&
            participant.status === 'left',
        );

      callParticipantStatusesRef.current = {
        ...callParticipantStatusesRef.current,
        [call.id]: nextParticipantStatuses,
      };

      if (remoteParticipantLeftActiveCommunityVoice) {
        playEndedCallSound();
      }

      if (
        details.kind === 'one-to-one' &&
        incomingCall?.call.id === call.id &&
        currentParticipant?.status !== 'ringing'
      ) {
        setIncomingCall(null);
        stopIncomingCallSound();
      }

      if (call.scope.type === 'community_channel') {
        const communityId = call.scope.communityId;
        const channelId = call.scope.channelId;
        const connectedIdentityIds =
          call.status === 'active'
            ? [
                ...new Set(
                  call.participants
                    .filter((participant) => participant.status === 'joined')
                    .map((participant) => participant.identityId),
                ),
              ]
            : [];

        setCommunities((current) =>
          current.map((community) => {
            if (community.id !== communityId) return community;

            return {
              ...community,
              voiceChannels: (community.voiceChannels ?? []).map((channel) =>
                channel.id === channelId
                  ? { ...channel, connectedIdentityIds }
                  : channel,
              ),
            };
          }),
        );
      }

      if (call.status !== 'active') {
        if (incomingCall?.call.id === call.id) setIncomingCall(null);

        if (activeCall?.id === call.id) {
          logCallWarning('workspace:call:ended-by-resource-status', {
            callId: call.id,
            status: call.status,
          });
          playEndedCallSound();
          endCall();
        }

        return;
      }

      if (details.kind === 'group') {
        if (incomingCall?.call.id === call.id) setIncomingCall(null);

        if (activeCall?.id === call.id) {
          logCallWarning('workspace:call:ended-unsupported-group-call', {
            callId: call.id,
          });
          playEndedCallSound();
          endCall();
        }

        return;
      }

      if (
        details.kind === 'one-to-one' &&
        activeCall?.id === call.id &&
        call.participants.some(
          (participant) =>
            participant.identityId !== session.identity.id &&
            ['declined', 'left', 'missed'].includes(participant.status),
        )
      ) {
        const remoteParticipant = call.participants.find(
          (participant) => participant.identityId !== session.identity.id,
        );

        logCallWarning('workspace:call:ended-by-remote-participant-status', {
          callId: call.id,
          remoteIdentityId: remoteParticipant?.identityId,
          remoteStatus: remoteParticipant?.status,
        });
        playEndedCallSound();
        endCall();

        return;
      }

      if (currentParticipant?.status === 'ringing') {
        if (details.kind === 'community-voice') return;

        const caller = details.participants.find(
          (participant) => participant.identityId === call.creatorIdentityId,
        );

        if (!notifiedIncomingCallIdsRef.current.has(call.id)) {
          notifiedIncomingCallIdsRef.current.add(call.id);
          void showPwaNotification({
            body: details.subtitle
              ? `${details.title} · ${details.subtitle}`
              : details.title,
            tag: `call-${call.id}`,
            title: copy.calls.incoming,
          });
        }

        setIncomingCall({
          call,
          caller,
          participants: details.participants,
          title: details.title,
        });

        return;
      }

      if (
        details.kind === 'one-to-one' &&
        currentParticipant?.status === 'joined' &&
        activeCall?.id !== call.id
      ) {
        logCallDebug('workspace:call:joined-on-another-device', {
          callId: call.id,
          identityId: session.identity.id,
        });

        return;
      }

      if (activeCall?.id === call.id) reconcileCall(call, details);
    },
    [
      activeCall?.id,
      callDetailsForResource,
      endCall,
      incomingCall?.call.id,
      reconcileCall,
      session.identity.id,
      setCommunities,
    ],
  );

  useEffect(() => {
    reconcileCallResourceRef.current = reconcileCallResource;
  }, [reconcileCallResource]);

  useEffect(() => {
    if (!activeCall?.call) return;

    reconcileCall(activeCall.call, callDetailsForResource(activeCall.call));
  }, [activeCall?.call, callDetailsForResource, reconcileCall]);

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
    const fallbackIceConfig = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    };

    let iceConfig;

    try {
      iceConfig = await applicationContainer.getCallIceServers(
        sessionRef.current,
      );
    } catch {
      return fallbackIceConfig;
    }

    return iceConfig.iceServers.length > 0 ? iceConfig : fallbackIceConfig;
  }, []);
  const requestLocalAudio = useCallback(async (): Promise<MediaStream> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(copy.calls.microphoneUnavailable);
    }

    try {
      return await CallMicrophoneCapture.capture(navigator.mediaDevices, {
        noiseCancellationEnabled: callNoiseCancellationEnabled,
      });
    } catch {
      throw new Error(copy.calls.microphoneUnavailable);
    }
  }, [callNoiseCancellationEnabled]);
  const stopLocalAudio = (stream: MediaStream | null) => {
    CallMicrophoneCapture.stop(stream);
  };
  const toggleCallNoiseCancellation = useCallback(() => {
    const enabled = !callNoiseCancellationEnabled;

    setCallNoiseCancellationEnabled(enabled);
    void toggleNoiseCancellation(enabled).catch((caught) => {
      setCallNoiseCancellationEnabled(!enabled);
      setSendError(toUserErrorMessage(caught, copy.workspace.sendError));
    });
  }, [callNoiseCancellationEnabled, toggleNoiseCancellation]);
  const removeCurrentIdentityFromVoicePresence = useCallback(() => {
    const identityId = sessionRef.current.identity.id;

    setCommunities((current) =>
      current.map((community) => ({
        ...community,
        voiceChannels: (community.voiceChannels ?? []).map((channel) => ({
          ...channel,
          connectedIdentityIds: (channel.connectedIdentityIds ?? []).filter(
            (connectedIdentityId) => connectedIdentityId !== identityId,
          ),
        })),
      })),
    );
  }, [setCommunities]);
  const leaveCallResource = useCallback(
    async (call: CallResource): Promise<void> => {
      const details = callDetailsForResource(call);

      if (details.kind === 'one-to-one') {
        await applicationContainer.endCall(sessionRef.current, call.id);

        return;
      }

      await applicationContainer.leaveCall(sessionRef.current, call.id);
    },
    [callDetailsForResource],
  );
  const cleanupJoinedCalls = useCallback(
    async (exceptCallId?: string): Promise<void> => {
      const identityId = sessionRef.current.identity.id;
      const calls = await applicationContainer.listCalls(sessionRef.current);
      const joinedCalls = calls.filter(
        (call) =>
          call.status === 'active' &&
          call.id !== exceptCallId &&
          call.participants.some(
            (participant) =>
              participant.identityId === identityId &&
              participant.status === 'joined',
          ),
      );

      if (joinedCalls.length === 0) return;

      await Promise.all(
        joinedCalls.map((call) =>
          leaveCallResource(call).catch(() => undefined),
        ),
      );
      removeCurrentIdentityFromVoicePresence();
    },
    [leaveCallResource, removeCurrentIdentityFromVoicePresence],
  );
  const leaveCurrentCallForSwitch = useCallback(async (): Promise<void> => {
    const current = activeCall;

    if (!current) return;

    endCall();
    removeCurrentIdentityFromVoicePresence();

    if (current.call) {
      await leaveCallResource(current.call).catch(() => undefined);
    }
  }, [
    activeCall,
    endCall,
    leaveCallResource,
    removeCurrentIdentityFromVoicePresence,
  ]);
  const startConversationCall = useCallback(
    (input: {
      conversationId: string;
      kind: 'group' | 'one-to-one';
      participants: CallParticipant[];
      title: string;
    }) => {
      if (input.kind === 'group') return;

      if (callActionInProgressRef.current) {
        logCallWarning(
          'workspace:conversation-call:ignored-action-in-progress',
          {
            conversationId: input.conversationId,
          },
        );

        return;
      }

      if (
        activeCall?.kind === input.kind &&
        activeCall.conversationId === input.conversationId
      ) {
        logCallWarning('workspace:conversation-call:ignored-already-active', {
          callId: activeCall.id,
          conversationId: input.conversationId,
        });

        return;
      }

      let localStream: MediaStream | null = null;

      callActionInProgressRef.current = true;
      const localAudioRequest = requestLocalAudio();

      void localAudioRequest
        .then(async (stream) => {
          localStream = stream;
          await leaveCurrentCallForSwitch();
          await cleanupJoinedCalls();

          logCallDebug('workspace:conversation-call:create-request', {
            conversationId: input.conversationId,
          });

          return await applicationContainer.startConversationCall(
            sessionRef.current,
            input.conversationId,
          );
        })
        .then(async (call) => {
          logCallDebug('workspace:conversation-call:created', {
            callId: call.id,
            conversationId: input.conversationId,
            participantStatuses: call.participants.map((participant) => ({
              identityId: participant.identityId,
              status: participant.status,
            })),
          });
          const details = callDetailsForResource(call);
          const iceConfig = await loadCallIceConfig();

          await startCall({
            ...details,
            call,
            currentIdentityId: sessionRef.current.identity.id,
            iceConfig,
            id: call.id,
            localStream,
            noiseCancellationEnabled: callNoiseCancellationEnabled,
            onSignal: callSignalSender(call.id),
            participants:
              details.participants.length > 0
                ? details.participants
                : input.participants,
            title: details.title || input.title,
          });
        })
        .catch((caught) => {
          stopLocalAudio(localStream);
          setSendError(toUserErrorMessage(caught, copy.workspace.sendError));
        })
        .finally(() => {
          callActionInProgressRef.current = false;
        });
    },
    [
      activeCall?.conversationId,
      activeCall?.id,
      activeCall?.kind,
      callNoiseCancellationEnabled,
      callDetailsForResource,
      callSignalSender,
      cleanupJoinedCalls,
      leaveCurrentCallForSwitch,
      loadCallIceConfig,
      requestLocalAudio,
      startCall,
    ],
  );
  const startCommunityVoiceCall = useCallback(
    (channel: {
      connectedIdentityIds?: string[];
      id: string;
      name: string;
    }) => {
      logCallDebug('workspace:community-voice-clicked', {
        activeCallId: activeCall?.id,
        activeCallKind: activeCall?.kind,
        channelId: channel.id,
        channelName: channel.name,
        communityId: activeCommunity?.id,
        connectedIdentityCount: channel.connectedIdentityIds?.length ?? 0,
      });

      if (!activeCommunity) {
        logCallWarning(
          'workspace:community-voice:ignored-no-active-community',
          {
            channelId: channel.id,
          },
        );

        return;
      }

      if (
        activeCall?.kind === 'community-voice' &&
        activeCall.communityId === activeCommunity.id &&
        activeCall.channelId === channel.id
      ) {
        logCallWarning('workspace:community-voice:ignored-already-active', {
          callId: activeCall.id,
          channelId: channel.id,
          communityId: activeCommunity.id,
        });

        return;
      }

      callActionInProgressRef.current = true;
      setSendError(null);
      let localStream: MediaStream | null = null;

      void (async () => {
        localStream = await requestLocalAudio().catch((caught): null => {
          logCallWarning('workspace:community-voice:microphone-unavailable', {
            channelId: channel.id,
            communityId: activeCommunity.id,
            error: caught,
          });

          return null;
        });

        logCallDebug('workspace:community-voice:leaving-current-call', {
          channelId: channel.id,
          communityId: activeCommunity.id,
        });
        await leaveCurrentCallForSwitch();
        await cleanupJoinedCalls();

        logCallDebug('workspace:community-voice:request-backend-join', {
          channelId: channel.id,
          communityId: activeCommunity.id,
        });
        const call = await applicationContainer.startCommunityChannelCall(
          sessionRef.current,
          activeCommunity.id,
          channel.id,
        );
        logCallDebug('workspace:community-voice:backend-joined', {
          callId: call.id,
          participantCount: call.participants.length,
          status: call.status,
        });
        const iceConfig = await loadCallIceConfig();
        logCallDebug('workspace:community-voice:ice-config-loaded', {
          callId: call.id,
          iceServerCount: iceConfig.iceServers.length,
        });
        const currentIdentityId = sessionRef.current.identity.id;
        const details = callDetailsForResource(call);

        logCallDebug('workspace:community-voice:start-local-session', {
          callId: call.id,
          participantCount: details.participants.length,
        });
        await startCall({
          ...details,
          call,
          currentIdentityId,
          iceConfig,
          id: call.id,
          localStream,
          noiseCancellationEnabled: callNoiseCancellationEnabled,
          onSignal: callSignalSender(call.id),
        });
        logCallDebug('workspace:community-voice:start-local-session-complete', {
          callId: call.id,
        });
        playAnsweredCallSound();
      })()
        .catch((caught) => {
          stopLocalAudio(localStream);
          logCallError('workspace:community-voice:failed', caught, {
            channelId: channel.id,
            communityId: activeCommunity.id,
          });
          setSendError(toUserErrorMessage(caught, copy.workspace.sendError));
        })
        .finally(() => {
          callActionInProgressRef.current = false;
        });
    },
    [
      activeCommunity,
      activeCall?.channelId,
      activeCall?.communityId,
      activeCall?.kind,
      callNoiseCancellationEnabled,
      callDetailsForResource,
      callSignalSender,
      cleanupJoinedCalls,
      leaveCurrentCallForSwitch,
      loadCallIceConfig,
      startCall,
    ],
  );

  const acceptIncomingCall = useCallback(() => {
    if (!incomingCall) return;

    if (callActionInProgressRef.current) {
      logCallWarning(
        'workspace:incoming-call:accept-ignored-action-in-progress',
        {
          callId: incomingCall.call.id,
        },
      );

      return;
    }

    const pendingCall = incomingCall.call;

    let localStream: MediaStream | null = null;

    callActionInProgressRef.current = true;

    void (async () => {
      const latestCall = await applicationContainer
        .getCall(sessionRef.current, pendingCall.id)
        .catch(() => pendingCall);
      const currentParticipant = latestCall.participants.find(
        (participant) =>
          participant.identityId === sessionRef.current.identity.id,
      );

      if (currentParticipant?.status !== 'ringing') {
        logCallDebug('workspace:incoming-call:accept-ignored-not-ringing', {
          callId: latestCall.id,
          participantStatus: currentParticipant?.status,
        });
        setIncomingCall(null);
        stopIncomingCallSound();

        return;
      }

      setIncomingCall(null);
      stopIncomingCallSound();
      localStream = await requestLocalAudio();

      await leaveCurrentCallForSwitch();
      await cleanupJoinedCalls(pendingCall.id);

      logCallDebug('workspace:incoming-call:join-request', {
        callId: pendingCall.id,
      });

      const call = await applicationContainer.joinCall(
        sessionRef.current,
        pendingCall.id,
      );
      const joinedParticipant = call.participants.find(
        (participant) =>
          participant.identityId === sessionRef.current.identity.id,
      );

      if (joinedParticipant?.status !== 'joined') {
        logCallDebug('workspace:incoming-call:join-skipped-not-joined', {
          callId: call.id,
          participantStatus: joinedParticipant?.status,
        });
        stopLocalAudio(localStream);

        return;
      }

      logCallDebug('workspace:incoming-call:joined', {
        callId: call.id,
        participantStatuses: call.participants.map((participant) => ({
          identityId: participant.identityId,
          status: participant.status,
        })),
      });
      const details = callDetailsForResource(call);
      const iceConfig = await loadCallIceConfig();

      await startCall({
        ...details,
        call,
        currentIdentityId: sessionRef.current.identity.id,
        iceConfig,
        id: call.id,
        localStream,
        noiseCancellationEnabled: callNoiseCancellationEnabled,
        onSignal: callSignalSender(call.id),
      });
    })()
      .catch((caught) => {
        stopLocalAudio(localStream);
        setSendError(toUserErrorMessage(caught, copy.workspace.sendError));
      })
      .finally(() => {
        callActionInProgressRef.current = false;
      });
  }, [
    callNoiseCancellationEnabled,
    callDetailsForResource,
    callSignalSender,
    cleanupJoinedCalls,
    incomingCall,
    leaveCurrentCallForSwitch,
    loadCallIceConfig,
    requestLocalAudio,
    startCall,
  ]);

  const declineIncomingCall = useCallback(() => {
    if (!incomingCall) return;

    const callId = incomingCall.call.id;

    setIncomingCall(null);
    stopIncomingCallSound();
    void applicationContainer
      .leaveCall(sessionRef.current, callId)
      .catch(() => undefined);
  }, [incomingCall]);

  const leaveActiveCall = useCallback(() => {
    const callId = activeCall?.id;
    const isCommunityVoiceCall = activeCall?.kind === 'community-voice';
    const shouldEndForEveryone = activeCall?.kind === 'one-to-one';

    endCall();
    removeCurrentIdentityFromVoicePresence();
    playEndedCallSound();

    if (!callId) return;

    const request = shouldEndForEveryone
      ? applicationContainer.endCall(sessionRef.current, callId)
      : applicationContainer.leaveCall(sessionRef.current, callId);

    void request
      .then(async () => {
        if (!isCommunityVoiceCall) return;

        await applicationContainer
          .getCall(sessionRef.current, callId)
          .then((call) => reconcileCallResourceRef.current(call))
          .catch(() => onCommunitiesReload());
      })
      .catch(() => undefined);
  }, [
    activeCall?.id,
    activeCall?.kind,
    endCall,
    onCommunitiesReload,
    removeCurrentIdentityFromVoicePresence,
  ]);

  const heartbeatActiveCall = useCallback(async (callId: string) => {
    await applicationContainer.heartbeatCallParticipant(
      sessionRef.current,
      callId,
    );
  }, []);

  useWorkspaceCallHeartbeat({
    activeCall,
    heartbeat: heartbeatActiveCall,
    onHeartbeatFailureLimit: leaveActiveCall,
  });

  useEffect(() => {
    let cancelled = false;
    const identityId = session.identity.id;

    if (callStartupSyncIdentityRef.current === identityId) return undefined;

    callStartupSyncIdentityRef.current = identityId;

    void applicationContainer
      .listCalls(session)
      .then(async (calls) => {
        if (cancelled) return;

        const staleJoinedCalls = calls.filter(
          (call) =>
            call.status === 'active' &&
            call.scope.type === 'community_channel' &&
            call.participants.some(
              (participant) =>
                participant.identityId === identityId &&
                participant.status === 'joined',
            ),
        );

        if (
          staleJoinedCalls.length > 0 &&
          !activeCallRef.current &&
          !callActionInProgressRef.current
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
  }, [onCommunitiesReload, removeCurrentIdentityFromVoicePresence, session]);

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
    const result = await applicationContainer.login(
      session.identity.id,
      session.password,
    );

    setSession(result.session);
    setConversations(result.conversations);
  }, [session.identity.id, session.password, setConversations, setSession]);

  const scrollMessagesToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto', keepPinned = false) => {
      const scroll = () => {
        const scroller = scrollerRef.current;

        if (!scroller) return;

        scroller.scrollTo({
          behavior,
          top: scroller.scrollHeight,
        });
        lastScrollTopRef.current = scroller.scrollTop;
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
        scroller.scrollTop = scroller.scrollHeight;
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
        });
        markConversationReadUntil(conversationId, result.messages);
        scrollMessagesToBottom('auto', true);
      } catch (caught) {
        if (messageRequestRef.current !== requestId) return;

        if (controller.signal.aborted) return;

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
      setMessages([]);
      updateMessageCursor(null);
      lastScrollTopRef.current = 0;
      setMessageLoadState('idle');

      return;
    }

    void loadActiveMessages(activeConversation.id);
  }, [
    activeConversation?.id,
    activeConversationKeyId,
    loadActiveMessages,
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
    if (
      workspaceMode !== 'messages' ||
      !activeConversation?.id ||
      !activeConversationKey ||
      !messageCursorRef.current ||
      messageStateRef.current === 'loading' ||
      Date.now() < suppressMessageLoadsUntilRef.current ||
      Date.now() < keepMessageBottomUntilRef.current
    )
      return;

    const requestId = messageRequestRef.current + 1;

    messageRequestRef.current = requestId;
    const previousHeight = scrollerRef.current?.scrollHeight ?? 0;
    const previousTop = scrollerRef.current?.scrollTop ?? 0;
    setMessageLoadState('loading');
    try {
      const result = await applicationContainer.loadMessages(
        sessionRef.current,
        activeConversation.id,
        messageCursorRef.current,
      );

      if (messageRequestRef.current !== requestId) return;

      setMessages((current) =>
        MessageCollection.merge(current, result.messages),
      );
      updateMessageCursor(result.nextCursor ?? null);
      requestAnimationFrame(() => {
        if (!scrollerRef.current) return;

        const nextTop =
          scrollerRef.current.scrollHeight - previousHeight + previousTop;

        scrollerRef.current.scrollTop = nextTop;
        lastScrollTopRef.current = nextTop;
      });
    } catch (caught) {
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

    if (isScrolledNearBottom()) setNewMessageCount(0);

    if (isScrollingUp && scrollTop < 80) void handleLoadOlder();
  };

  const sendPendingMessage = (payload: PendingSend) => {
    if (!activeConversation?.id) return;
    const conversationId = activeConversation.id;
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
        const lastMessageId = MessageCollection.lastDelivered(
          messagesRef.current,
        )?.id;
        const sent = await applicationContainer.sendMessage(
          session,
          conversationId,
          payload.content,
          {
            attachments: payload.attachments,
            attachmentUpload: payload.attachmentUpload,
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
          void applicationContainer.markStickerUsed(session, payload.sticker);
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
    const result = await applicationContainer.publishKeychain(session, {
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

        setMessages((current) => MessageCollection.merge(current, [message]));

        const isEditMessage = message.raw.type === 'edited';

        if (shouldAutoScroll) {
          markConversationReadUntil(conversationId, [message]);
          scrollMessagesToBottom('smooth', true);
        } else if (!isEditMessage) {
          setNewMessageCount((current) => current + 1);
        }
      } catch (caught) {
        setSendError(
          toUserErrorMessage(caught, copy.workspace.loadMessagesError),
        );
      }
    },
    [markConversationReadUntil, scrollMessagesToBottom, session],
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

      if (event.type.startsWith('calls.')) {
        const eventCallId =
          eventAggregateId(event) ?? stringAttribute(event, 'callId');

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

          if (
            callId &&
            senderIdentityId &&
            recipientIdentityId === session.identity.id &&
            signalType &&
            payload
          ) {
            void receiveSignal({
              callId,
              payload,
              senderIdentityId,
              signalType,
            }).catch(() => undefined);
          }

          return;
        }

        const callId = eventAggregateId(event);

        if (!callId) return;

        void applicationContainer
          .getCall(sessionRef.current, callId)
          .then((call) => {
            logCallDebug('workspace:realtime-call-event:resource-loaded', {
              activeCallId: activeCallRef.current?.id,
              callId: call.id,
              participantStatuses: call.participants.map((participant) => ({
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
            .getIdentity(session.identity.id)
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
        const pageVisible = isBrowserPageVisible();
        const isActiveChannel =
          pageVisible &&
          workspaceMode === 'community' &&
          communityId === activeCommunity?.id &&
          channelId === activeCommunityChannelId;

        if (
          communityId &&
          channelId &&
          !isActiveChannel &&
          authorIdentityId !== session.identity.id
        ) {
          const preview = communityNotificationPreview(
            communities,
            communityId,
            channelId,
            authorIdentityId,
            identityNames,
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
        const isSelectedConversation =
          workspaceMode === 'messages' &&
          !!conversationId &&
          conversationId === activeConversation?.id;
        const isActiveConversation =
          isSelectedConversation && isBrowserPageVisible();

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
          );

          playNotificationSoundIfAllowed();
          void showPwaNotification({
            body: preview.body,
            tag: `conversation-${conversationId}`,
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

          if (timelineMessage) {
            const shouldAutoScroll = isScrolledNearBottom();
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
      reconcileCallResource,
      session,
      setConversations,
      setCommunities,
      setSession,
      updateCommunityState,
      workspaceMode,
    ],
  );

  const handleRealtimeTyping = useCallback(
    (message: RealtimeTypingMessage) => {
      if (message.identityId === session.identity.id) return;

      const expiresAt = Date.now() + 5000;

      if (message.scope === 'conversation') {
        setConversationTypingEntries((current) =>
          updateTypingEntries(
            current,
            message.conversationId,
            message.identityId,
            message.active ? expiresAt : null,
          ),
        );

        return;
      }

      setCommunityTypingEntries((current) =>
        updateTypingEntries(
          current,
          communityTypingKey(message.communityId, message.channelId),
          message.identityId,
          message.active ? expiresAt : null,
        ),
      );
    },
    [session.identity.id],
  );
  const sendTyping = useCallback(
    (input: RealtimeTypingInput) => {
      const key = typingInputKey(input);
      const current = typingSentRef.current.get(key);
      const now = Date.now();

      if (input.active && current?.active && now - current.sentAt < 2500) {
        return;
      }

      if (!input.active && current && !current.active) return;

      typingSentRef.current.set(key, { active: input.active, sentAt: now });
      sendRealtimeTyping(session, input);
    },
    [session],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setConversationTypingEntries(expireTypingEntries);
      setCommunityTypingEntries(expireTypingEntries);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useRealtimeEvents(session, {
    onConnected: () => {
      setRealtimeStatus('connected');
    },
    onDisconnected: () => setRealtimeStatus('reconnecting'),
    onDomainEvent: handleRealtimeEvent,
    onReconnecting: () => setRealtimeStatus('reconnecting'),
    onTyping: handleRealtimeTyping,
  });
  const conversationTypingIdentityIds = activeTypingIdentityIds(
    conversationTypingEntries,
    activeConversation?.id,
  );
  const communityTypingIdentityIds = activeTypingIdentityIds(
    communityTypingEntries,
    activeCommunity && activeCommunityChannelId
      ? communityTypingKey(activeCommunity.id, activeCommunityChannelId)
      : null,
  );
  const sendConversationTyping = useCallback(
    (active: boolean) => {
      if (!activeConversation?.id) return;

      sendTyping({
        active,
        conversationId: activeConversation.id,
        scope: 'conversation',
      });
    },
    [activeConversation?.id, sendTyping],
  );
  const sendCommunityTyping = useCallback(
    (channelId: string, active: boolean) => {
      if (!activeCommunity?.id) return;

      sendTyping({
        active,
        channelId,
        communityId: activeCommunity.id,
        scope: 'community_channel',
      });
    },
    [activeCommunity?.id, sendTyping],
  );
  const hasWorkspaceDialogOpen =
    inspectorOpen ||
    isCreateCommunityOpen ||
    isCreateOpen ||
    !!incomingCall ||
    !!messageContextMenu ||
    nodeSettingsOpen ||
    notificationsOpen ||
    !!rawMessage ||
    realtimeEventsOpen;
  const showPushEnablePrompt =
    pushPermission === 'default' && !pushPromptDismissed;

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
          communityUnreadCounts={communityUnreadCounts}
          messageNotificationCount={unreadMessageCount}
          notificationCount={inboxNotificationCount}
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
          onNotificationsClick={openNotificationsPanel}
          onSettingsClick={() => setNodeSettingsOpen(true)}
          settingsAttention={nodeUnclaimed}
        />

        {workspaceMode === 'messages' ? (
          <>
            <div
              className={cx(
                'app-safe-area-drawer-until-lg app-safe-area-drawer-flush fixed inset-y-0 left-0 z-40 w-full max-w-[430px] p-0 transition sm:w-[calc(86vw+82px)] sm:max-w-[442px] lg:static lg:block lg:w-auto lg:max-w-none',
                sidebarOpen ? 'block' : 'hidden lg:block',
              )}
            >
              <div className="grid h-full grid-cols-[82px_minmax(0,1fr)] gap-0 lg:block">
                <Rail
                  className="lg:hidden"
                  activeMessages
                  activeCommunityId={null}
                  communities={communities}
                  communityUnreadCounts={communityUnreadCounts}
                  messageNotificationCount={unreadMessageCount}
                  notificationCount={inboxNotificationCount}
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
                  onNotificationsClick={openNotificationsPanel}
                  onSettingsClick={() => setNodeSettingsOpen(true)}
                  onInspectorClick={() => setInspectorOpen(true)}
                  peerCount={peers.length}
                  settingsAttention={nodeUnclaimed}
                />
                <Suspense fallback={null}>
                  <Sidebar
                    activeCall={activeCall}
                    session={session}
                    conversations={conversationsWithUnread}
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
                    onCreate={() => setIsCreateOpen(true)}
                    onCallEnd={leaveActiveCall}
                    onCallParticipantVolumeChange={setParticipantVolume}
                    onCallParticipantScreenShareVolumeChange={
                      setParticipantScreenShareVolume
                    }
                    onCallToggleCamera={toggleCamera}
                    onCallToggleDeafen={toggleDeafen}
                    onCallToggleMute={toggleMute}
                    onCallToggleNoiseCancellation={toggleCallNoiseCancellation}
                    onCallToggleScreenShareAudio={toggleScreenShareAudio}
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

            {sidebarOpen && (
              <button
                className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                onClick={() => setSidebarOpen(false)}
                aria-label={copy.workspace.closeSidebar}
              />
            )}

            <Suspense fallback={null}>
              <ChatColumn
                session={session}
                activeConversation={activeConversation}
                conversationKey={activeConversationKey}
                draft={activeConversationDraft}
                editingMessage={editingMessage?.message ?? null}
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
                presenceByIdentityId={presenceByIdentityId}
                messages={messages}
                messageState={messageState}
                newMessageCount={newMessageCount}
                nodeNetworks={nodeNetworks}
                sendError={sendError}
                scrollerRef={scrollerRef}
                bottomRef={bottomRef}
                onScroll={handleScroll}
                onCancelEdit={cancelMessageEdit}
                onEditMessage={handleEditMessage}
                onSend={handleSend}
                onStickerSend={handleSendSticker}
                onConversationKeyImported={handleConversationKeyImported}
                onDraftChange={updateActiveConversationDraft}
                onEscape={closeTransientUi}
                onJumpToLatest={jumpToLatestMessages}
                onMessageMenuOpen={handleMessageMenuOpen}
                onReactionToggle={(message, emoji, reacted) =>
                  void handleToggleMessageReaction(message, emoji, reacted)
                }
                onReplyReferenceClick={(messageId) =>
                  void handleReplyReferenceClick(messageId)
                }
                onOpenSidebar={() => setSidebarOpen(true)}
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
                typingIdentityIds={conversationTypingIdentityIds}
              />
            </Suspense>

            <Suspense fallback={null}>
              <Inspector
                className="hidden xl:block"
                session={session}
                activeConversation={activeConversation}
                loadedMessageCount={messages.length}
                peers={peers}
              />
            </Suspense>
          </>
        ) : activeCommunity ? (
          <Suspense fallback={null}>
            <CommunityWorkspace
              activeChannelId={activeCommunityChannelId}
              channelUnreadCounts={
                communityUnreadCountsById[activeCommunity.id] ?? {}
              }
              community={activeCommunity}
              mobileMembersOpen={communityMembersOpen}
              mobileSidebarOpen={sidebarOpen}
              mobileRail={
                <Rail
                  activeCommunityId={activeCommunity.id}
                  communities={communities}
                  communityUnreadCounts={communityUnreadCounts}
                  messageNotificationCount={unreadMessageCount}
                  notificationCount={inboxNotificationCount}
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
                  onNotificationsClick={openNotificationsPanel}
                  onSettingsClick={() => setNodeSettingsOpen(true)}
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
              onCallToggleCamera={toggleCamera}
              onCallToggleDeafen={toggleDeafen}
              onCallToggleMute={toggleMute}
              onCallToggleNoiseCancellation={toggleCallNoiseCancellation}
              onCallToggleScreenShareAudio={toggleScreenShareAudio}
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
              session={session}
              typingIdentityIds={communityTypingIdentityIds}
              onJoinVoiceChannel={startCommunityVoiceCall}
            />
          </Suspense>
        ) : (
          <div className="glass-panel-strong col-span-3 flex h-full flex-col justify-center rounded-none p-4 text-center text-sm text-white/55">
            {copy.communities.empty}
          </div>
        )}
      </div>

      {showPushEnablePrompt && !hasWorkspaceDialogOpen ? (
        <PushNotificationPrompt
          enableState={pushEnableState}
          error={pushEnableError}
          onDismiss={() => setPushPromptDismissed(true)}
          onEnable={() => void enablePushNotifications()}
        />
      ) : null}

      {hasWorkspaceDialogOpen ? (
        <Suspense fallback={null}>
          <WorkspaceDialogs
            activeConversation={activeConversation}
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
            notificationAction={notificationAction}
            notificationError={notificationError}
            notificationsOpen={notificationsOpen}
            peers={peers}
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
            onDeleteMessage={(message) => void handleDeleteMessage(message)}
            onEditMessage={startEditingMessage}
            onCopyMessage={copyMessageContent}
            onNetworksUpdated={onNodeNetworksReload}
            onReplyToMessage={(message) => {
              setReplyTarget(message);
              setEditingMessage(null);
              setMessageContextMenu(null);
            }}
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
