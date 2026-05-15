import {
  type Dispatch,
  type SetStateAction,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { UUID } from '@haskou/value-objects';

import type {
  ChatMessage,
  AttachmentProgress,
  Community,
  CommunityChannel,
  ConversationKeyEntry,
  ConversationResource,
  MessageResource,
  MessageReplyPreview,
  Session,
} from '../../domain/types';
import type {
  CallParticipant,
  CallResource,
  CallSignalType,
  CallSession,
} from '../../domain/calls/CallSession';
import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { Peer } from '../../application/peers/ListPeers';

import { pigeonApplication } from '../../application/applicationContainer';
import { conversationKeyEntry } from '../../domain/conversations/conversationKey';
import {
  bumpConversationActivity,
  sortConversationsByLatestMessage,
} from '../../domain/conversations/conversationOrdering';
import { conversationPeerIdentityId } from '../../domain/conversations/conversationPeer';
import { pendingFileAttachments } from '../../domain/attachments/pendingFileAttachments';
import { mergeMessages } from '../../domain/messages/mergeMessages';
import {
  communityChannels,
  communityTextChannels,
} from '../../domain/communities/communityChannels';
import { copy } from '../../i18n/en';
import { useIdentityDirectory } from '../../presentation/hooks/useIdentityDirectory';
import { useNotifications } from '../../presentation/hooks/useNotifications';
import { useRealtimeEvents } from '../../presentation/hooks/useRealtimeEvents';
import { useUnreadMessages } from '../../presentation/hooks/useUnreadMessages';
import {
  requestPwaNotificationPermission,
  showPwaNotification,
} from '../../presentation/notifications/PwaNotifications';
import { useCallSession } from '../../presentation/hooks/useCallSession';
import type { RealtimeDomainEvent } from '../../infrastructure/realtime/RealtimeGateway';
import {
  logCallDebug,
  logCallError,
  logCallWarning,
} from '../../infrastructure/media/callDebugLogger';
import { isBrowserPreviewImage } from '../../utils/browserPreview';
import { cx } from '../../utils/classNameHelper';
import { shortId } from '../../utils/formatting';
import {
  playAnsweredCallSound,
  playEndedCallSound,
  playIncomingCallSound,
  playNotificationSound,
  stopIncomingCallSound,
} from '../../utils/sounds';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import type { PendingCommunityInviteLink } from '../../utils/communityInviteLink';
import { CreateConversationDialog } from '../dialog/CreateConversationDialog';
import { CreateCommunityDialog } from '../community/CreateCommunityDialog';
import { CommunityWorkspace } from '../community/CommunityWorkspace';
import { IncomingCallDialog } from '../calls/IncomingCallDialog';
import { ChatColumn } from './ChatColumn';
import { Inspector } from './Inspector';
import { NodeSettingsDialog } from './NodeSettingsDialog';
import { NotificationsPanel } from './NotificationsPanel';
import { Rail } from './Rail';
import { RealtimeEventsDialog } from './RealtimeEventsDialog';
import {
  MessageContextMenu,
  type MessageContextMenuState,
} from './MessageContextMenu';
import { RawMessageDialog } from './RawMessageDialog';
import {
  callSignalTypeAttribute,
  communityAttribute,
  communityChannelAttribute,
  eventAggregateId,
  recordAttribute,
  stringAttribute,
} from './realtimeEventAttributes';
import { Sidebar } from './Sidebar';
import {
  communityUnreadStorageKey,
  type CommunityUnreadCounts,
  type ConversationDrafts,
  draftsStorageKey,
  initialConversationId,
  lastConversationStorageKey,
  loadCommunityUnreadCounts,
  loadDrafts,
  loadWorkspacePreference,
  type WorkspacePreference,
  workspaceStorageKey,
} from './workspacePersistence';

type LoadState = 'idle' | 'loading' | 'error';
type PendingSend = {
  attachments: File[];
  content: string;
  replyTarget: ChatMessage | null;
};
type FailedSends = Record<string, PendingSend>;

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

function communityNotificationBody(
  communities: Community[],
  communityId: string,
  channelId: string,
): string {
  const community = communities.find((item) => item.id === communityId);
  const channel = community
    ? communityChannels(community).find((item) => item.id === channelId)
    : undefined;

  return channel
    ? `${community?.name ?? communityId} #${channel.name}`
    : (community?.name ?? communityId);
}

function updateMessageReaction(
  message: ChatMessage,
  authorIdentityId: string,
  emoji: string,
  action: 'add' | 'remove',
): ChatMessage {
  const withoutReaction = message.reactions.filter(
    (reaction) =>
      reaction.authorIdentityId !== authorIdentityId || reaction.emoji !== emoji,
  );
  const reactions =
    action === 'add'
      ? [
          ...withoutReaction,
          { authorIdentityId, createdAt: Date.now(), emoji },
        ]
      : withoutReaction;

  return {
    ...message,
    raw: { ...message.raw, reactions },
    reactions,
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
  onPendingCommunityInviteHandled?: () => void;
  pendingCommunityInvite?: PendingCommunityInviteLink | null;
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
  onPendingCommunityInviteHandled,
  pendingCommunityInvite,
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
  const [workspacePreference] = useState<WorkspacePreference>(() =>
    loadWorkspacePreference(session.identity.id),
  );
  const [workspaceMode, setWorkspaceMode] = useState<'community' | 'messages'>(
    workspacePreference.mode ?? 'messages',
  );
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(
    workspacePreference.communityId ?? null,
  );
  const [communityChannelById, setCommunityChannelById] = useState<
    Record<string, string>
  >(() => workspacePreference.channelByCommunityId ?? {});
  const [communityRealtimeEvent, setCommunityRealtimeEvent] =
    useState<RealtimeDomainEvent | null>(null);
  const [communityUnreadCountsById, setCommunityUnreadCountsById] =
    useState<CommunityUnreadCounts>(() =>
      loadCommunityUnreadCounts(session.identity.id),
    );
  const [realtimeStatus, setRealtimeStatus] = useState<
    'connected' | 'reconnecting'
  >('reconnecting');
  const [realtimeEventsOpen, setRealtimeEventsOpen] = useState(false);
  const [realtimeEventLog, setRealtimeEventLog] = useState<
    RealtimeDomainEvent[]
  >([]);
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
  const [communityMembersOpen, setCommunityMembersOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    call: CallResource;
    caller?: CallParticipant;
    participants: CallParticipant[];
    title: string;
  } | null>(null);
  const [nodeSettingsOpen, setNodeSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const keepMessageBottomUntilRef = useRef(0);
  const messageCursorRef = useRef<string | null>(null);
  const messageRequestRef = useRef(0);
  const messageStateRef = useRef<LoadState>('idle');
  const messagesRef = useRef<ChatMessage[]>([]);
  const activeCallRef = useRef<CallSession | null>(null);
  const callActionInProgressRef = useRef(false);
  const callStartupSyncIdentityRef = useRef<string | null>(null);
  const pendingCommunityInviteRef = useRef<string | null>(null);
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
    setParticipantVolume,
    startCall,
    toggleDeafen,
    toggleMute,
  } = useCallSession();

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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

  const suppressMessageLoadsBriefly = useCallback(() => {
    suppressMessageLoadsUntilRef.current = Date.now() + 800;
  }, []);

  const openNotificationsPanel = useCallback(() => {
    suppressMessageLoadsBriefly();
    void requestPwaNotificationPermission();
    setNotificationsOpen(true);
  }, [suppressMessageLoadsBriefly]);

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
  const activeCommunity = useMemo(
    () =>
      communities.find((community) => community.id === activeCommunityId) ??
      communities[0],
    [activeCommunityId, communities],
  );
  const activeCommunityTextChannels = useMemo(
    () => (activeCommunity ? communityTextChannels(activeCommunity) : []),
    [activeCommunity],
  );
  const activeCommunityChannelId = useMemo(() => {
    if (!activeCommunity) return null;

    const storedId = communityChannelById[activeCommunity.id];

    return storedId &&
      activeCommunityTextChannels.some((channel) => channel.id === storedId)
      ? storedId
      : (activeCommunityTextChannels[0]?.id ?? null);
  }, [activeCommunity, activeCommunityTextChannels, communityChannelById]);
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
    pendingCount: pendingNotificationCount,
    refresh: refreshNotifications,
    visible: visibleNotifications,
  } = useNotifications({
    onAccepted: handleNotificationAccepted,
    onAcceptedPanelClose: closeNotificationsPanel,
    session,
  });

  useEffect(() => {
    if (!pendingCommunityInvite) return;
    if (pendingCommunityInviteRef.current === pendingCommunityInvite.token) {
      return;
    }

    pendingCommunityInviteRef.current = pendingCommunityInvite.token;
    setSendError(null);
    void (async () => {
      const acceptedCommunity = await pigeonApplication.acceptCommunityInviteLink(
        sessionRef.current,
        pendingCommunityInvite.token,
      );
      let nextSession = sessionRef.current;

      if (pendingCommunityInvite.keyEntry) {
        const published = await pigeonApplication.publishKeychain(nextSession, {
          ...nextSession.keychain,
          conversations: {
            ...nextSession.keychain.conversations,
            [pendingCommunityInvite.keyEntry.conversationId]:
              pendingCommunityInvite.keyEntry,
          },
        });

        nextSession = {
          ...nextSession,
          keychain: published.keychain,
          keychainExternalIdentifier: published.keychainExternalIdentifier,
        };
        setSession(nextSession);
      }

      setCommunities((current) => [
        acceptedCommunity,
        ...current.filter((community) => community.id !== acceptedCommunity.id),
      ]);
      setActiveCommunityId(acceptedCommunity.id);
      setWorkspaceMode('community');
      onPendingCommunityInviteHandled?.();
    })().catch((caught) => {
      pendingCommunityInviteRef.current = null;
      setSendError(toUserErrorMessage(caught, copy.communities.memberError));
    });
  }, [
    onPendingCommunityInviteHandled,
    pendingCommunityInvite,
    setCommunities,
    setSession,
  ]);
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
  const callParticipantForIdentity = useCallback(
    (identityId: string): CallParticipant => {
      const identity =
        identityId === session.identity.id
          ? session.identity
          : identityProfiles[identityId];

      return {
        identity,
        identityId,
        muted: false,
        name:
          identityNames[identityId] ??
          identity?.profile.name?.trim() ??
          identityId,
        picture: identityPictures[identityId] ?? null,
      };
    },
    [identityNames, identityPictures, identityProfiles, session.identity],
  );
  const callDetailsForResource = useCallback(
    (
      call: CallResource,
    ): {
      channelId?: string;
      communityId?: string;
      conversationId?: string;
      kind: CallSession['kind'];
      participants: CallParticipant[];
      subtitle?: string;
      title: string;
    } => {
      const participantIds =
        call.scope.type === 'community_channel'
          ? call.participants
              .filter((participant) => participant.status === 'joined')
              .map((participant) => participant.identityId)
          : call.participantIds;
      const participants = participantIds.map((identityId) => {
        const participant = callParticipantForIdentity(identityId);
        const status = call.participants.find(
          (item) => item.identityId === identityId,
        )?.status;

        return { ...participant, status };
      });

      const scope = call.scope;

      if (scope.type === 'community_channel') {
        const community = communities.find(
          (item) => item.id === scope.communityId,
        );
        const channel = community
          ? communityChannels(community).find(
              (item) => item.id === scope.channelId,
            )
          : undefined;

        return {
          channelId: scope.channelId,
          communityId: scope.communityId,
          kind: 'community-voice',
          participants,
          subtitle: community?.name ?? copy.communities.privateCommunity,
          title: channel?.name ?? copy.calls.voiceChannel,
        };
      }

      const conversation = conversations.find(
        (item) => item.id === scope.conversationId,
      );
      const peerIdentityId = conversation
        ? conversationPeerIdentityId(
            conversation,
            session.identity.id,
            session.keychain,
          )
        : undefined;
      const peerIdentity = peerIdentityId
        ? identityProfiles[peerIdentityId]
        : undefined;
      const peerHandle = peerIdentity?.profile.handle?.trim();
      const oneToOneTitle =
        peerIdentity?.profile.name.trim() ||
        (peerHandle ? `@${peerHandle}` : undefined) ||
        (peerIdentityId ? identityNames[peerIdentityId] : undefined) ||
        copy.chat.noConversation;
      const groupTitle =
        conversation?.name ?? conversation?.title ?? copy.chat.noConversation;
      const kind = conversation?.type === 'group' ? 'group' : 'one-to-one';

      return {
        conversationId: scope.conversationId,
        kind,
        participants,
        subtitle:
          kind === 'one-to-one'
            ? peerHandle
              ? `@${peerHandle}`
              : peerIdentityId
                ? shortId(peerIdentityId)
                : undefined
            : undefined,
        title: kind === 'one-to-one' ? oneToOneTitle : groupTitle,
      };
    },
    [
      callParticipantForIdentity,
      communities,
      conversations,
      identityNames,
      identityProfiles,
      session.identity.id,
      session.keychain,
    ],
  );
  const reconcileCallResource = useCallback(
    (call: CallResource) => {
      const details = callDetailsForResource(call);
      const currentParticipant = call.participants.find(
        (participant) => participant.identityId === session.identity.id,
      );

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

        setIncomingCall({
          call,
          caller,
          participants: details.participants,
          title: details.title,
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
        await pigeonApplication.sendCallSignal(sessionRef.current, callId, {
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
      iceConfig = await pigeonApplication.getCallIceServers(sessionRef.current);
    } catch {
      return fallbackIceConfig;
    }

    return iceConfig.iceServers.length > 0 ? iceConfig : fallbackIceConfig;
  }, []);
  const requestLocalAudio =
    useCallback(async (): Promise<MediaStream> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(copy.calls.microphoneUnavailable);
      }

      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      } catch {
        throw new Error(copy.calls.microphoneUnavailable);
      }
    }, []);
  const stopLocalAudio = (stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  };
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
        await pigeonApplication.endCall(sessionRef.current, call.id);
        return;
      }

      await pigeonApplication.leaveCall(sessionRef.current, call.id);
    },
    [callDetailsForResource],
  );
  const cleanupJoinedCalls = useCallback(
    async (exceptCallId?: string): Promise<void> => {
      const identityId = sessionRef.current.identity.id;
      const calls = await pigeonApplication.listCalls(sessionRef.current);
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
        logCallWarning('workspace:conversation-call:ignored-action-in-progress', {
          conversationId: input.conversationId,
        });
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
          return await pigeonApplication.startConversationCall(
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
        logCallWarning('workspace:community-voice:ignored-no-active-community', {
          channelId: channel.id,
        });
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

      void (async () => {
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
        const call = await pigeonApplication.startCommunityChannelCall(
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
          onSignal: callSignalSender(call.id),
        });
        logCallDebug('workspace:community-voice:start-local-session-complete', {
          callId: call.id,
        });
        playAnsweredCallSound();
      })()
        .catch((caught) => {
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
      logCallWarning('workspace:incoming-call:accept-ignored-action-in-progress', {
        callId: incomingCall.call.id,
      });
      return;
    }

    const pendingCall = incomingCall.call;

    setIncomingCall(null);
    stopIncomingCallSound();
    let localStream: MediaStream | null = null;

    callActionInProgressRef.current = true;
    const localAudioRequest = requestLocalAudio();

    void localAudioRequest
      .then(async (stream) => {
        localStream = stream;
        await leaveCurrentCallForSwitch();
        await cleanupJoinedCalls(pendingCall.id);

        logCallDebug('workspace:incoming-call:join-request', {
          callId: pendingCall.id,
        });
        return await pigeonApplication.joinCall(
          sessionRef.current,
          pendingCall.id,
        );
      })
      .then(async (call) => {
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
          onSignal: callSignalSender(call.id),
        });
      })
      .catch((caught) => {
        stopLocalAudio(localStream);
        setSendError(toUserErrorMessage(caught, copy.workspace.sendError));
      })
      .finally(() => {
        callActionInProgressRef.current = false;
      });
  }, [
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
    void pigeonApplication
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
      ? pigeonApplication.endCall(sessionRef.current, callId)
      : pigeonApplication.leaveCall(sessionRef.current, callId);

    void request
      .then(async () => {
        if (!isCommunityVoiceCall) return;

        await pigeonApplication
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

  useEffect(() => {
    let cancelled = false;
    const identityId = session.identity.id;

    if (callStartupSyncIdentityRef.current === identityId) return undefined;

    callStartupSyncIdentityRef.current = identityId;

    void pigeonApplication
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
              pigeonApplication
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

  useEffect(() => {
    setDrafts(loadDrafts(session.identity.id));
    setCommunityUnreadCountsById(
      loadCommunityUnreadCounts(session.identity.id),
    );
  }, [session.identity.id]);

  useEffect(() => {
    const preference = loadWorkspacePreference(session.identity.id);

    setWorkspaceMode(preference.mode ?? 'messages');
    setActiveCommunityId(preference.communityId ?? null);
    setCommunityChannelById(preference.channelByCommunityId ?? {});
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

  useEffect(() => {
    const preference: WorkspacePreference = {
      channelByCommunityId: communityChannelById,
      communityId: activeCommunity?.id ?? activeCommunityId,
      mode: workspaceMode,
    };

    globalThis.localStorage?.setItem(
      workspaceStorageKey(session.identity.id),
      JSON.stringify(preference),
    );
  }, [
    activeCommunity?.id,
    activeCommunityId,
    communityChannelById,
    session.identity.id,
    workspaceMode,
  ]);

  useEffect(() => {
    globalThis.localStorage?.setItem(
      communityUnreadStorageKey(session.identity.id),
      JSON.stringify(communityUnreadCountsById),
    );
  }, [communityUnreadCountsById, session.identity.id]);

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

  const closeTransientUi = useCallback(() => {
    setMessageContextMenu(null);
    setRawMessage(null);
    setReplyTarget(null);
    setIsCreateOpen(false);
    setIsCreateCommunityOpen(false);
    closeNotificationsPanel();
    setNodeSettingsOpen(false);
    setRealtimeEventsOpen(false);
    setInspectorOpen(false);
    setCommunityMembersOpen(false);
    setSidebarOpen(false);
  }, [closeNotificationsPanel]);

  const markConversationReadUntil = useCallback(
    (conversationId: string, loadedMessages: ChatMessage[]) => {
      const lastMessage = [...loadedMessages]
        .reverse()
        .find((message) => !message.deliveryStatus);

      if (!lastMessage) return;

      clearUnreadMessages(conversationId);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      );
      void pigeonApplication
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

      messageRequestRef.current = requestId;
      setMessages([]);
      updateMessageCursor(null);
      setMessageLoadState('loading');
      setSendError(null);
      try {
        const result = await pigeonApplication.loadMessages(
          sessionRef.current,
          conversationId,
        );

        if (messageRequestRef.current !== requestId) return;

        setMessages(result.messages);
        updateMessageCursor(result.nextCursor ?? null);
        markConversationReadUntil(conversationId, result.messages);
        scrollMessagesToBottom('auto', true);
      } catch (caught) {
        if (messageRequestRef.current !== requestId) return;

        setMessages([]);
        setMessageLoadState('error');
        setSendError(
          toUserErrorMessage(caught, copy.workspace.loadMessagesError),
        );

        return;
      }
      if (messageRequestRef.current !== requestId) return;

      setMessageLoadState('idle');
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
    setNewMessageCount(0);
    lastScrollTopRef.current = 0;

    if (!activeConversationKeyId) {
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
      const result = await pigeonApplication.loadMessages(
        sessionRef.current,
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
      bumpConversationActivity(current, conversationId, optimisticTimestamp),
    );
    setFailedSends((current) => {
      const next = { ...current };

      delete next[optimisticId];

      return next;
    });
    setMessages((current) => [
      ...current,
      {
        attachments: pendingFileAttachments(payload.attachments, optimisticId),
        authorIdentityId: session.identity.id,
        content:
          payload.content ||
          payload.attachments.map((attachment) => attachment.name).join(', '),
        deliveryStatus: 'pending',
        encrypted: false,
        id: optimisticId,
        mine: true,
        raw: { id: optimisticId, type: 'sent' },
        reactions: [],
        replyPreview: replyPreviewFromMessage(payload.replyTarget),
        replyToMessageId: payload.replyTarget?.id,
        timestamp: optimisticTimestamp,
      },
    ]);
    scrollMessagesToBottom('smooth');

    sendQueueRef.current = sendQueueRef.current.then(async () => {
      try {
        const lastMessageId = [...messagesRef.current]
          .reverse()
          .find((message) => !message.deliveryStatus)?.id;
        const sent = await pigeonApplication.sendMessage(
          session,
          conversationId,
          payload.content,
          {
            attachments: payload.attachments,
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
          },
        );

        setMessages((current) =>
          mergeMessages(
            current.filter((message) => message.id !== optimisticId),
            [sent],
          ),
        );
        setConversations((current) =>
          bumpConversationActivity(current, conversationId, sent.timestamp),
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

  const handleSend = (content: string, attachments: File[]): Promise<void> => {
    const payload = { attachments, content, replyTarget };

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
    setMessageLoadState('loading');
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
          ? updateMessageReaction(
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
        await pigeonApplication.removeMessageReaction(
          session,
          conversationId,
          message.id,
          emoji,
        );
      } else {
        await pigeonApplication.addMessageReaction(
          session,
          conversationId,
          message.id,
          emoji,
        );
      }

      const refreshed = await pigeonApplication.loadMessage(
        session,
        conversationId,
        message.id,
      );

      if (refreshed) {
        setMessages((current) => mergeMessages(current, [refreshed]));
      }
    } catch (caught) {
      setSendError(toUserErrorMessage(caught, copy.messages.reactionError));
      const refreshed = await pigeonApplication
        .loadMessage(session, conversationId, message.id)
        .catch(() => null);

      if (refreshed) {
        setMessages((current) => mergeMessages(current, [refreshed]));
      }
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
          markConversationReadUntil(conversationId, [message]);
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

        void pigeonApplication
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
            logCallError('workspace:realtime-call-event:resource-load-failed', caught, {
              callId,
              eventType: event.type,
            });
          });
        return;
      }

      if (event.type.startsWith('nodes.')) {
        void onPeersReload().catch(() => undefined);
        return;
      }

      if (event.type.startsWith('notifications.')) {
        playNotificationSound();
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

      if (event.type.startsWith('identities.')) {
        if (event.aggregate_id === session.identity.id) {
          void pigeonApplication
            .getIdentity(session.identity.id)
            .then((identity) => setSession({ ...session, identity }))
            .catch(() => undefined);
        }
        return;
      }

      if (event.type === 'communities.v1.channel.message.was_sent') {
        const communityId =
          eventAggregateId(event) ?? stringAttribute(event, 'communityId');
        const channelId = stringAttribute(event, 'channelId');
        const authorIdentityId = stringAttribute(event, 'authorIdentityId');
        const isActiveChannel =
          workspaceMode === 'community' &&
          communityId === activeCommunity?.id &&
          channelId === activeCommunityChannelId;

        if (
          communityId &&
          channelId &&
          !isActiveChannel &&
          authorIdentityId !== session.identity.id
        ) {
          playNotificationSound();
          void showPwaNotification({
            body: communityNotificationBody(
              communities,
              communityId,
              channelId,
            ),
            tag: `community-${communityId}-${channelId}`,
            title: copy.communities.channelMessageNotification,
          });
          markCommunityChannelUnread(communityId, channelId);
        }

        setCommunityRealtimeEvent(event);
        return;
      }

      if (
        event.type === 'communities.v1.channel.message.was_deleted' ||
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
            const channels = communityChannels(community);

            if (channels.some((item) => item.id === channel.id)) {
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
            current.map((item) => (item.id === community.id ? community : item)),
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
            current.map((item) => (item.id === community.id ? community : item)),
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
            current.map((item) => (item.id === community.id ? community : item)),
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
        const isActiveConversation =
          workspaceMode === 'messages' &&
          !!conversationId &&
          conversationId === activeConversation?.id;

        if ((!messageId && !timelineMessage) || !conversationId) return;

        setConversations((current) =>
          bumpConversationActivity(current, conversationId, event.occurred_on),
        );

        if (
          !isActiveConversation &&
          !isReactionEvent &&
          authorId !== session.identity.id &&
          timelineMessage?.actorIdentityId !== session.identity.id
        ) {
          const unreadMessageId = messageId ?? timelineMessage?.id;

          playNotificationSound();
          void showPwaNotification({
            body: copy.chat.newMessage,
            tag: `conversation-${conversationId}`,
            title: copy.chat.directMessage,
          });
          if (unreadMessageId)
            markUnreadMessage(conversationId, unreadMessageId);
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

          if (isReactionEvent && messageId) {
            void pigeonApplication
              .loadMessage(session, conversationId, messageId)
              .then((message) => {
                if (!message) return;

                setMessages((current) => mergeMessages(current, [message]));
              })
              .catch(() => undefined);
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

            setMessages((current) => mergeMessages(current, [message]));
            if (shouldAutoScroll) scrollMessagesToBottom('smooth', true);
            return;
          }

          if (
            !activeConversationKeyId ||
            !messageId ||
            messages.some((message) => message.id === messageId)
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
      activeCommunityChannelId,
      activeConversation?.id,
      activeConversationKeyId,
      clearUnreadMessages,
      communities,
      fetchRealtimeMessage,
      isScrolledNearBottom,
      markCommunityChannelUnread,
      markUnreadMessage,
      messages,
      onCommunitiesReload,
      onPeersReload,
      refreshConversations,
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

  useRealtimeEvents(session, {
    onConnected: () => {
      setRealtimeStatus('connected');
    },
    onDisconnected: () => setRealtimeStatus('reconnecting'),
    onDomainEvent: handleRealtimeEvent,
    onReconnecting: () => setRealtimeStatus('reconnecting'),
  });

  return (
    <section className="relative z-10 min-h-full">
      <div className="app-workspace mx-auto grid max-w-[1800px] grid-cols-1 gap-0 px-0 pb-0 sm:h-[calc(100dvh-1rem)] sm:gap-3 sm:px-4 sm:pb-4 lg:grid-cols-[82px_330px_minmax(0,1fr)] xl:grid-cols-[82px_330px_minmax(0,1fr)_320px]">
        <Rail
          className="hidden lg:flex"
          activeMessages={workspaceMode === 'messages'}
          activeCommunityId={
            workspaceMode === 'community' ? activeCommunity?.id : null
          }
          communities={communities}
          communityUnreadCounts={communityUnreadCounts}
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
          onNotificationsClick={openNotificationsPanel}
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
                  activeMessages
                  activeCommunityId={null}
                  communities={communities}
                  communityUnreadCounts={communityUnreadCounts}
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
                  onNotificationsClick={openNotificationsPanel}
                  onSettingsClick={() => setNodeSettingsOpen(true)}
                  onInspectorClick={() => setInspectorOpen(true)}
                  peerCount={peers.length}
                  settingsAttention={nodeUnclaimed}
                />
                <Sidebar
                  activeCall={activeCall}
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
                  onCallEnd={leaveActiveCall}
                  onCallParticipantVolumeChange={setParticipantVolume}
                  onCallToggleDeafen={toggleDeafen}
                  onCallToggleMute={toggleMute}
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
              onReactionToggle={(message, emoji, reacted) =>
                void handleToggleMessageReaction(message, emoji, reacted)
              }
              onReplyReferenceClick={(messageId) =>
                void handleReplyReferenceClick(messageId)
              }
              onOpenSidebar={() => setSidebarOpen(true)}
              onCreate={() => setIsCreateOpen(true)}
              progress={attachmentProgress}
              realtimeStatus={realtimeStatus}
              onRealtimeEventsOpen={openRealtimeEvents}
              replyToMessage={replyTarget}
              onCancelReply={() => setReplyTarget(null)}
              onRetryMessage={retryMessage}
              onStartCall={startConversationCall}
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
            onCallToggleDeafen={toggleDeafen}
            onCallToggleMute={toggleMute}
            realtimeEvent={communityRealtimeEvent}
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
            onLogout={() => setSession(null)}
            onMobileSidebarClose={() => setSidebarOpen(false)}
            onMobileMembersClose={() => setCommunityMembersOpen(false)}
            onOpenMobileSidebar={() => setSidebarOpen(true)}
            onSessionUpdated={(nextSession) => {
              setSession(nextSession);
              rememberIdentity(nextSession.identity);
            }}
            realtimeStatus={realtimeStatus}
            onRealtimeEventsOpen={openRealtimeEvents}
            session={session}
            onJoinVoiceChannel={startCommunityVoiceCall}
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
          onCreated={({ community, session: nextSession }) => {
            setSession(nextSession);
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
          onClose={closeNotificationsPanel}
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
      {realtimeEventsOpen && (
        <RealtimeEventsDialog
          events={realtimeEventLog}
          onClose={() => setRealtimeEventsOpen(false)}
        />
      )}
      {incomingCall && (
        <IncomingCallDialog
          caller={incomingCall.caller}
          onAccept={acceptIncomingCall}
          onDecline={declineIncomingCall}
          title={incomingCall.title}
        />
      )}
    </section>
  );
}
