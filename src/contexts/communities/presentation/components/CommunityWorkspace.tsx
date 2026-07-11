import {
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { NodeNetwork } from '../../../networks/application/list-node-networks/ListNodeNetworks';
import type { CallSession } from '../../../calls/domain/callSession.types';
import type {
  Community,
  CommunityChannelThreadSummary,
  CommunityTextChannel,
  CommunityInvitationNotificationResource,
  CommunityVoiceChannel,
  ConversationKeyEntry,
  ChatMessage,
  IdentityPresence,
  IdentityResource,
  MessageResource,
  NotificationSettingMap,
  NotificationSettingScope,
  PollResource,
  SelectablePresenceStatus,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { MessageContextMenuState } from '../../../../app/presentation/workspace/components/messageContextMenu';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { CommunityChannels } from '../../domain/CommunityChannels';
import { CommunityMessageDecryptWorkerClient } from '../../infrastructure/crypto/CommunityMessageDecryptWorkerClient';
import { CommunityAccessPolicy } from '../../domain/CommunityAccessPolicy';
import { NotificationSettingsPolicy } from '../../../notifications/domain/NotificationSettingsPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { runWhenBrowserIdle } from '../../../../shared/presentation/runWhenBrowserIdle';
import { shortId } from '../../../../shared/presentation/formatting';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { Composer } from '../../../messages/presentation/components/Composer';
import { MessageCollectionDialog } from '../../../messages/presentation/components/MessageCollectionDialog';
import { MessageThreadPanel } from '../../../messages/presentation/components/MessageThreadPanel';
import { TypingIndicator } from '../../../messages/presentation/components/TypingIndicator';
import {
  profileAnchorFromTarget,
  type ProfilePopoverAnchor,
} from '../../../identities/presentation/view-models/profilePopoverAnchor';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { CommunitySidebar } from './CommunitySidebar';
import { CommunityHeader } from './CommunityHeader';
import { CommunityHeaderActionsMenu } from './CommunityHeaderActionsMenu';
import { loadPublicImage } from './communityImages';
import { memberDisplayName, memberPrimaryName } from './communityMemberNames';
import {
  CommunityMembersPanel,
  type CommunityMemberListItem,
} from './communityMembersPanel';
import { CommunityMessageTimeline } from './CommunityMessageTimeline';
import {
  CommunityMessageSearchPanel,
  type CommunityMessageSearchResultItem,
} from './CommunityMessageSearchPanel';
import {
  CommunityWorkspaceDialogs,
  type CommunityProfileView,
} from './CommunityWorkspaceDialogs';
import type { NotificationScopeSettingsTarget } from '../../../notifications/presentation/components/NotificationScopeSettingsDialog';
import {
  CommunityMentionPanel,
} from './communityMentionPanel';
import {
  mergeChatMessages,
  resolveCommunityChannelId,
} from './communityWorkspaceHelpers';
import {
  type CommunityThreadState,
  hiddenCommunityThreadSummaryKeysFromMessages,
  isThreadRootMessage,
  threadRootLabelKey,
  threadTitleFromMessage,
  visibleCommunityThreadSummaries,
} from './communityThreadState';
import { useCommunityMembers } from './useCommunityMembers';
import { useCommunityChannelMessages } from './useCommunityChannelMessages';
import { useCommunityChannelRealtime } from './useCommunityChannelRealtime';
import { useCommunityMessageComposer } from './useCommunityMessageComposer';
import { useCommunityKeyDialog } from './useCommunityKeyDialog';
import { useCommunityThreadActions } from './useCommunityThreadActions';
import { useCommunityThreadNavigation } from './useCommunityThreadNavigation';
import { useCommunityMentions } from './useCommunityMentions';
import { useCommunityPinnedMessages } from './useCommunityPinnedMessages';
import { useCommunityPollWorkflow } from './useCommunityPollWorkflow';
import { useCommunityMessageSearch } from './useCommunityMessageSearch';
import { communityMessageIdentityIds } from './communityMessageIdentityIds';

const CreatePollDialog = lazy(() =>
  import('../../../polls/presentation/components/CreatePollDialog').then(
    (module) => ({
      default: module.CreatePollDialog,
    }),
  ),
);
const StickerPackPreviewDialog = lazy(() =>
  import('../../../stickers/presentation/components/StickerPackPreviewDialog').then(
    (module) => ({
      default: module.StickerPackPreviewDialog,
    }),
  ),
);

interface CommunityWorkspaceProps {
  activeChannelId?: null | string;
  activeCall?: CallSession | null;
  animateSidePanelEntries?: boolean;
  channelUnreadCounts?: Record<string, number>;
  community: Community;
  invitationAccepting?: boolean;
  invitationError?: null | string;
  invitationInviterName?: string;
  timelineFocusKey?: string;
  mobileMembersOpen: boolean;
  mobileSidebarOpen: boolean;
  mobileRail?: ReactNode;
  nodeNetworks: NodeNetwork[];
  presenceByIdentityId?: Record<string, IdentityPresence>;
  onChannelSelected: (channelId: string) => void;
  onChannelViewed?: (channelId: string) => void;
  onCommunityLeft: (community: Community) => void;
  onCommunityUpdated: (community: Community) => void;
  onInvitationAccept?: (
    notification: CommunityInvitationNotificationResource,
  ) => void;
  notificationSettingsByScopeKey: NotificationSettingMap;
  onCallEnd?: () => void;
  onCallParticipantVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallParticipantScreenShareVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallScreenShareQualityChange?: (
    quality: CallSession['screenShareQuality'],
  ) => void;
  onCallToggleCamera?: () => void;
  onCallToggleDeafen?: () => void;
  onCallToggleMute?: () => void;
  onCallToggleNoiseCancellation?: () => void;
  onCallRetryMicrophone?: () => void;
  onCallToggleScreenShare?: () => void;
  onLogout: () => void;
  onPresenceChange?: (presence: IdentityPresence) => void;
  onPresenceStatusSelected?: (status: SelectablePresenceStatus) => void;
  onMobileMembersClose: () => void;
  onMobileSidebarClose: () => void;
  onOpenMobileSidebar: () => void;
  onNotificationSettingsOpen: (target: NotificationScopeSettingsTarget) => void;
  onNotificationMuteToggle: (scope: NotificationSettingScope) => void;
  onJoinVoiceChannel?: (channel: CommunityVoiceChannel) => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
  ) => Promise<void>;
  onRealtimeEventsOpen?: () => void;
  onSessionUpdated: (session: Session) => void;
  onTypingActive?: (channelId: string, active: boolean) => void;
  pendingInvitation?: CommunityInvitationNotificationResource | null;
  realtimeEvent?: null | RealtimeDomainEvent;
  realtimeStatus?: 'connected' | 'reconnecting';
  session: Session;
  typingIdentityIds?: string[];
}

type ChannelThreadCacheEntry = {
  storedAt: number;
  threadsByChannelId: Record<string, CommunityChannelThreadSummary[]>;
};

const CHANNEL_THREAD_CACHE_TTL_MS = 15_000;
const channelThreadCacheByCommunityId = new Map<
  string,
  ChannelThreadCacheEntry
>();

function threadSummariesByChannelId(
  channels: CommunityTextChannel[],
): Record<string, CommunityChannelThreadSummary[]> {
  return Object.fromEntries(
    channels.map((channel) => [channel.id, channel.threads ?? []]),
  );
}

function withThreadRootLabelKeys(
  current: Set<string>,
  keys: string[],
): Set<string> {
  let next: Set<string> | undefined;

  for (const key of keys) {
    if (current.has(key)) continue;

    next ??= new Set(current);
    next.add(key);
  }

  return next ?? current;
}

function communityEncryptionDetails({
  channelEncryptionReady,
  community,
  communityIsPublic,
  communityKey,
  networkName,
  selectedChannel,
}: {
  channelEncryptionReady: boolean;
  community: Community;
  communityIsPublic: boolean;
  communityKey?: ConversationKeyEntry;
  networkName: string;
  selectedChannel?: CommunityTextChannel;
}) {
  return {
    note: communityIsPublic
      ? copy.encryption.publicCommunityNote
      : channelEncryptionReady
        ? copy.encryption.communityNote
        : copy.encryption.missingNote,
    rows: [
      {
        label: copy.encryption.scope,
        value: selectedChannel
          ? `${community.name} / #${selectedChannel.name}`
          : community.name,
      },
      {
        label: copy.encryption.network,
        value: networkName,
      },
      {
        label: copy.encryption.algorithm,
        value: communityIsPublic
          ? copy.encryption.plaintext
          : (communityKey?.algorithm ?? copy.encryption.unknown),
      },
      {
        label: copy.encryption.keyVersion,
        value: communityKey ? `v${communityKey.version}` : '-',
      },
      {
        label: copy.encryption.createdAt,
        value: communityKey
          ? new Intl.DateTimeFormat(undefined, {
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              month: 'short',
              year: 'numeric',
            }).format(new Date(communityKey.createdAt))
          : '-',
      },
    ],
    secrets: communityIsPublic
      ? []
      : [
          {
            label: copy.encryption.communityKey,
            sensitive: true,
            value: communityKey?.key,
          },
        ],
    status: communityIsPublic
      ? ('public' as const)
      : channelEncryptionReady
        ? ('ready' as const)
        : ('missing' as const),
    subtitle: selectedChannel
      ? shortId(selectedChannel.id)
      : shortId(community.id),
    title: copy.encryption.communityTitle,
  };
}

function cachedChannelThreadsFor(
  communityId: string,
): Record<string, CommunityChannelThreadSummary[]> | null {
  const entry = channelThreadCacheByCommunityId.get(communityId);

  if (!entry) return null;

  if (Date.now() - entry.storedAt > CHANNEL_THREAD_CACHE_TTL_MS) {
    channelThreadCacheByCommunityId.delete(communityId);

    return null;
  }

  return entry.threadsByChannelId;
}

export function CommunityWorkspace({
  activeCall,
  activeChannelId,
  animateSidePanelEntries = true,
  channelUnreadCounts = {},
  community,
  invitationAccepting = false,
  invitationError,
  invitationInviterName,
  timelineFocusKey,
  mobileMembersOpen,
  mobileRail,
  mobileSidebarOpen,
  nodeNetworks,
  notificationSettingsByScopeKey,
  onCallEnd,
  onCallParticipantScreenShareVolumeChange,
  onCallParticipantVolumeChange,
  onCallScreenShareQualityChange,
  onCallToggleCamera,
  onCallToggleDeafen,
  onCallToggleMute,
  onCallToggleNoiseCancellation,
  onCallRetryMicrophone,
  onCallToggleScreenShare,
  onChannelSelected,
  onChannelViewed,
  onCommunityLeft,
  onCommunityUpdated,
  onInvitationAccept,
  onJoinVoiceChannel,
  onLogout,
  onMobileMembersClose,
  onMobileSidebarClose,
  onNotificationSettingsOpen,
  onNotificationMuteToggle,
  onOpenConversationWithIdentity,
  onOpenMobileSidebar,
  onPresenceChange,
  onPresenceStatusSelected,
  onRealtimeEventsOpen,
  onSessionUpdated,
  onTypingActive,
  pendingInvitation,
  presenceByIdentityId = {},
  realtimeEvent,
  realtimeStatus = 'connected',
  session,
  typingIdentityIds = [],
}: CommunityWorkspaceProps) {
  const textChannels = useMemo(
    () => CommunityChannels.text(community),
    [community],
  );
  const voiceChannels = useMemo(
    () => CommunityChannels.voice(community),
    [community],
  );
  const currentPermissions = useMemo(
    () => CommunityAccessPolicy.permissionsFor(community, session.identity.id),
    [community, session.identity.id],
  );
  const currentRoleIds = useMemo(
    () =>
      CommunityAccessPolicy.assignedRoleIdsFor(community, session.identity.id),
    [community, session.identity.id],
  );
  const communityNotificationScope = useMemo(
    () =>
      ({
        communityId: community.id,
        type: 'community',
      }) satisfies NotificationSettingScope,
    [community.id],
  );
  const communityNotificationSetting = useMemo(
    () =>
      NotificationSettingsPolicy.resolve(
        notificationSettingsByScopeKey,
        communityNotificationScope,
      ),
    [communityNotificationScope, notificationSettingsByScopeKey],
  );
  const channelNotificationScope = useCallback(
    (channelId: string): NotificationSettingScope => ({
      channelId,
      communityId: community.id,
      type: 'community_channel',
    }),
    [community.id],
  );
  const channelNotificationSetting = useCallback(
    (channel: { id: string }) =>
      NotificationSettingsPolicy.resolve(
        notificationSettingsByScopeKey,
        channelNotificationScope(channel.id),
      ),
    [channelNotificationScope, notificationSettingsByScopeKey],
  );
  const accessibleTextChannels = useMemo(
    () =>
      textChannels.filter((channel) =>
        CommunityAccessPolicy.canSeeChannel(
          community,
          channel,
          session.identity.id,
        ),
      ),
    [community, session.identity.id, textChannels],
  );
  const accessibleVoiceChannels = useMemo(
    () =>
      voiceChannels.filter((channel) =>
        CommunityAccessPolicy.canSeeChannel(
          community,
          channel,
          session.identity.id,
        ),
      ),
    [community, session.identity.id, voiceChannels],
  );
  const resolvedChannelId = useMemo(
    () => resolveCommunityChannelId(activeChannelId, accessibleTextChannels),
    [accessibleTextChannels, activeChannelId],
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftSyncTimersRef = useRef(new Map<string, number>());
  const [stickerPackPreview, setStickerPackPreview] =
    useState<StickerMessageReference | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerViewerOpen, setBannerViewerOpen] = useState(false);
  const [communityDataOpen, setCommunityDataOpen] = useState(false);
  const [encryptionDetailsOpen, setEncryptionDetailsOpen] = useState(false);
  const [communityMenuOpen, setCommunityMenuOpen] = useState(false);
  const [communityLeaveError, setCommunityLeaveError] = useState<string | null>(
    null,
  );
  const [communityLeaving, setCommunityLeaving] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [messageContextMenu, setMessageContextMenu] =
    useState<MessageContextMenuState | null>(null);
  const [profileViewer, setProfileViewer] =
    useState<CommunityProfileView | null>(null);
  const [rawMessage, setRawMessage] = useState<ChatMessage | null>(null);
  const [threadPanel, setThreadPanel] = useState<CommunityThreadState | null>(
    null,
  );
  const [channelThreadsByChannelId, setChannelThreadsByChannelId] = useState<
    Record<string, CommunityChannelThreadSummary[]>
  >(() => threadSummariesByChannelId(textChannels));
  const [threadRootLabels, setThreadRootLabels] = useState<
    Record<string, string>
  >({});
  const [hiddenThreadRootLabelKeys, setHiddenThreadRootLabelKeys] = useState<
    Set<string>
  >(() => new Set());
  const [polls, setPolls] = useState<PollResource[]>([]);
  const [pollDialogOpen, setPollDialogOpen] = useState(false);

  useCloseOnEscape(onMobileSidebarClose, mobileSidebarOpen);
  const memberIdentitiesRef = useRef<Record<string, IdentityResource>>({});
  const unresolvedThreadRootLabelKeysRef = useRef(new Set<string>());
  const onCommunityUpdatedRef = useRef(onCommunityUpdated);
  const communityMessageDecryptWorkerRef =
    useRef<CommunityMessageDecryptWorkerClient | null>(null);
  const pendingSearchResultRef =
    useRef<CommunityMessageSearchResultItem | null>(null);
  const pendingFocusedMessageRef = useRef<{
    channelId: string;
    message: ChatMessage;
  } | null>(null);
  const communityKey = session.keychain.conversations[community.id];
  const {
    close: closeCommunityKeyDialog,
    copyEncryptedKey: copyCommunityKey,
    dialog: communityKeyDialog,
    encryptedKey: communityKeyEncrypted,
    error: communityKeyError,
    importKey: importCommunityKey,
    input: communityKeyInput,
    openAdd: openAddCommunityKeyDialog,
    openCopy: openCopyCommunityKeyDialog,
    saving: communityKeySaving,
    setInput: setCommunityKeyInput,
  } = useCommunityKeyDialog({
    community,
    communityKey,
    onSessionUpdated,
    session,
  });
  const communityIsPublic = community.visibility === 'public';
  const textChannelsWithThreads = useMemo(
    () =>
      textChannels.map((channel) => ({
        ...channel,
        threads: visibleCommunityThreadSummaries({
          channelId: channel.id,
          hiddenThreadRootLabelKeys,
          threads:
            channelThreadsByChannelId[channel.id] ?? channel.threads ?? [],
        }),
      })),
    [channelThreadsByChannelId, hiddenThreadRootLabelKeys, textChannels],
  );
  useEffect(() => {
    setThreadRootLabels({});
    setHiddenThreadRootLabelKeys(new Set());
    unresolvedThreadRootLabelKeysRef.current.clear();
  }, [community.id]);
  useEffect(() => {
    setChannelThreadsByChannelId(threadSummariesByChannelId(textChannels));
  }, [community.id, textChannels]);
  useEffect(() => {
    const cached = cachedChannelThreadsFor(community.id);

    if (cached) {
      setChannelThreadsByChannelId(cached);
    }

    let cancelled = false;

    const cancelIdleWork = runWhenBrowserIdle(() => {
      void applicationContainer
        .listCommunityChannels(session, community.id)
        .then((channels) => {
          if (cancelled) return;

          const threadsByChannelId = threadSummariesByChannelId(
            channels.filter((channel) => channel.type === 'text'),
          );

          channelThreadCacheByCommunityId.set(community.id, {
            storedAt: Date.now(),
            threadsByChannelId,
          });
          setChannelThreadsByChannelId(threadsByChannelId);
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
      cancelIdleWork();
    };
  }, [community.id, session, textChannels]);
  const projectChannelMessages = useCallback(
    async (channelId: string, rawMessages: MessageResource[]) => {
      communityMessageDecryptWorkerRef.current ??=
        new CommunityMessageDecryptWorkerClient();

      return await communityMessageDecryptWorkerRef.current.decrypt({
        channelId,
        communityId: community.id,
        communityKey,
        copy: copy.messages,
        currentIdentityId: session.identity.id,
        messages: rawMessages,
      });
    },
    [community.id, communityKey, session.identity.id],
  );
  const projectChannelMessage = useCallback(
    async (
      channelId: string,
      rawMessage: MessageResource,
    ): Promise<ChatMessage> => {
      const [projected] = await projectChannelMessages(channelId, [rawMessage]);

      return projected;
    },
    [projectChannelMessages],
  );
  const loadChannelMessages = useCallback(
    async (
      channelId: string,
      beforeMessageId?: string,
      options: { limit?: number } = {},
    ) => {
      const result = await applicationContainer.listCommunityChannelMessages(
        session,
        community.id,
        channelId,
        { beforeMessageId, limit: options.limit },
      );
      const loadedMessages = await projectChannelMessages(
        channelId,
        result.messages,
      );

      return {
        cursor: result.nextBeforeMessageId ?? null,
        loadedMessages,
      };
    },
    [community.id, projectChannelMessages, session],
  );
  const {
    bottomRef,
    handleChannelSelected,
    handleMessagesScroll,
    incrementNewChannelMessageCount,
    isAwayFromBottom,
    isScrolledNearBottom,
    jumpToLatest,
    messageCursor,
    messages,
    messageState,
    newChannelMessageCount,
    resetNewChannelMessageCount,
    scrollChannelToBottom,
    scrollerRef,
    selectedChannelId,
    setSelectedChannelId,
    setMessages,
    visibleMessages,
  } = useCommunityChannelMessages({
    loadChannelMessages,
    onChannelSelected,
    onChannelViewed,
    onMobileSidebarClose,
    resolvedChannelId,
    timelineFocusKey,
  });
  useEffect(() => {
    if (!selectedChannelId) return;

    const channelThreads = channelThreadsByChannelId[selectedChannelId] ?? [];

    if (channelThreads.length === 0) return;

    const hiddenKeys = hiddenCommunityThreadSummaryKeysFromMessages({
      channelId: selectedChannelId,
      messages,
      threads: channelThreads,
    });

    if (hiddenKeys.length === 0) return;

    setHiddenThreadRootLabelKeys((current) =>
      withThreadRootLabelKeys(current, hiddenKeys),
    );
  }, [channelThreadsByChannelId, messages, selectedChannelId]);
  const draft = selectedChannelId ? (drafts[selectedChannelId] ?? '') : '';
  const scheduleChannelDraftSync = useCallback(
    (channelId: string, value: string) => {
      const currentTimer = draftSyncTimersRef.current.get(channelId);

      if (currentTimer) window.clearTimeout(currentTimer);

      const timer = window.setTimeout(() => {
        draftSyncTimersRef.current.delete(channelId);

        if (value.trim()) {
          void applicationContainer
            .saveCommunityChannelDraft(session, community.id, channelId, value)
            .catch(() => undefined);

          return;
        }

        void applicationContainer
          .deleteCommunityChannelDraft(session, community.id, channelId)
          .catch(() => undefined);
      }, 700);

      draftSyncTimersRef.current.set(channelId, timer);
    },
    [community.id, session],
  );
  const setSelectedChannelDraft = useCallback(
    (next: SetStateAction<string>) => {
      if (!selectedChannelId) return;

      setDrafts((current) => {
        const currentValue = current[selectedChannelId] ?? '';
        const value = typeof next === 'function' ? next(currentValue) : next;

        scheduleChannelDraftSync(selectedChannelId, value);

        return {
          ...current,
          [selectedChannelId]: value,
        };
      });
    },
    [scheduleChannelDraftSync, selectedChannelId],
  );
  const owner = community.ownerIdentityId === session.identity.id;
  const network =
    nodeNetworks.find((item) => item.id === community.networkId) ?? null;
  const networkName = network?.name ?? shortId(community.networkId);
  const selectedChannel = textChannelsWithThreads.find(
    (channel) => channel.id === selectedChannelId,
  );
  const canManageMessages = currentPermissions.has('manage_messages');
  const closeMessageContextMenu = useCallback(
    () => setMessageContextMenu(null),
    [],
  );
  const {
    close: closePinnedMessages,
    collection: messageCollection,
    messageIds: pinnedMessageIds,
    open: openPinnedMessages,
    pin: pinMessage,
    unpin: unpinMessage,
    unpinFromCollection: unpinMessageFromDialog,
  } = useCommunityPinnedMessages({
    canManageMessages,
    closeMessageMenu: closeMessageContextMenu,
    communityId: community.id,
    projectMessages: projectChannelMessages,
    realtimeEvent,
    selectedChannelId,
    session,
  });
  const showPinnedMessages = useCallback(() => {
    setCommunityMenuOpen(false);
    void openPinnedMessages();
  }, [openPinnedMessages]);
  const selectedChannelPolls = useMemo(
    () =>
      selectedChannelId
        ? polls.filter(
            (poll) =>
              poll.scope.type === 'community_channel' &&
              poll.scope.communityId === community.id &&
              poll.scope.channelId === selectedChannelId,
          )
        : [],
    [community.id, polls, selectedChannelId],
  );
  const channelNameFor = useCallback(
    (channelId: string) =>
      textChannelsWithThreads.find((channel) => channel.id === channelId)
        ?.name ?? shortId(channelId),
    [textChannelsWithThreads],
  );
  const scrollToChannelMessage = useCallback(
    (messageId: string) => {
      const scroll = (attempt = 0) => {
        const element = scrollerRef.current?.querySelector<HTMLElement>(
          `[data-message-id="${CSS.escape(messageId)}"]`,
        );

        if (!element) {
          if (attempt < 8) {
            window.setTimeout(() => scroll(attempt + 1), 60);
          }

          return;
        }

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusTarget =
          element.querySelector<HTMLElement>('[data-message-bubble]') ??
          element;

        focusTarget.classList.add('message-focus-ring');
        window.setTimeout(
          () => focusTarget.classList.remove('message-focus-ring'),
          1600,
        );
      };

      requestAnimationFrame(() => scroll());
    },
    [scrollerRef],
  );
  const handleSearchResultClick = useCallback(
    (result: CommunityMessageSearchResultItem) => {
      pendingSearchResultRef.current = result;

      if (result.channelId !== selectedChannelId) {
        handleChannelSelected(result.channelId);

        return;
      }

      setMessages((current) => mergeChatMessages(current, [result.message]));
      scrollToChannelMessage(result.message.id);
      pendingSearchResultRef.current = null;
    },
    [
      handleChannelSelected,
      scrollToChannelMessage,
      selectedChannelId,
      setMessages,
    ],
  );
  const messageSearch = useCommunityMessageSearch({
    channelNameFor,
    communityId: community.id,
    communityIsPublic,
    onResultClick: handleSearchResultClick,
    projectChannelMessage,
    selectedChannelId,
    session,
  });
  const upsertChannelThreadSummary = useCallback(
    (channelId: string, summary: CommunityChannelThreadSummary) => {
      setHiddenThreadRootLabelKeys((current) => {
        const key = threadRootLabelKey(channelId, summary.rootMessageId);

        if (!current.has(key)) return current;

        const next = new Set(current);

        next.delete(key);

        return next;
      });
      setChannelThreadsByChannelId((current) => {
        const currentThreads = current[channelId] ?? [];
        const nextThreads = [
          summary,
          ...currentThreads.filter(
            (thread) => thread.rootMessageId !== summary.rootMessageId,
          ),
        ].sort((left, right) => right.lastReplyAt - left.lastReplyAt);

        return {
          ...current,
          [channelId]: nextThreads,
        };
      });
    },
    [],
  );
  const {
    open: openMessageThread,
    openFromSummary: openMessageThreadFromSummary,
  } = useCommunityThreadNavigation({
    communityId: community.id,
    currentIdentityId: session.identity.id,
    messages,
    onChannelSelected: handleChannelSelected,
    projectMessages: projectChannelMessages,
    selectedChannelId,
    session,
    setMessageContextMenu,
    setThreadPanel,
    upsertSummary: upsertChannelThreadSummary,
  });
  const activeVoiceChannelId =
    activeCall?.kind === 'community-voice' &&
    activeCall.communityId === community.id
      ? (activeCall.channelId ?? null)
      : null;
  const visibleTextChannels = useMemo(() => {
    const query = channelSearch.trim().toLowerCase();
    const accessibleChannels = accessibleTextChannels
      .map(
        (channel) =>
          textChannelsWithThreads.find((item) => item.id === channel.id) ??
          channel,
      )
      .filter(
        (channel) =>
          channel.id === selectedChannelId ||
          !NotificationSettingsPolicy.shouldHide(
            channelNotificationSetting(channel),
          ),
      );

    if (!query) return accessibleChannels;

    return accessibleChannels.filter((channel) =>
      channel.name.toLowerCase().includes(query),
    );
  }, [
    accessibleTextChannels,
    channelNotificationSetting,
    channelSearch,
    selectedChannelId,
    textChannelsWithThreads,
  ]);
  useEffect(() => {
    const unresolvedKeys = unresolvedThreadRootLabelKeysRef.current;
    const channelsWithMissingRootLabels = visibleTextChannels
      .map((channel) => {
        const rootMessageIds = (channel.threads ?? [])
          .map((thread) => thread.rootMessageId)
          .filter(
            (rootMessageId) =>
              !threadRootLabels[rootMessageId] &&
              !unresolvedKeys.has(
                threadRootLabelKey(channel.id, rootMessageId),
              ),
          );

        return {
          channelId: channel.id,
          rootMessageIds: [...new Set(rootMessageIds)],
        };
      })
      .filter((channel) => channel.rootMessageIds.length > 0);

    if (channelsWithMissingRootLabels.length === 0) return undefined;

    let cancelled = false;

    void (async () => {
      for (const channel of channelsWithMissingRootLabels) {
        const remainingRootMessageIds = new Set(channel.rootMessageIds);
        let beforeMessageId: string | undefined;

        for (
          let page = 0;
          page < 8 && remainingRootMessageIds.size > 0 && !cancelled;
          page += 1
        ) {
          const result =
            await applicationContainer.listCommunityChannelMessages(
              session,
              community.id,
              channel.channelId,
              { beforeMessageId },
            );
          const loadedMessages = await projectChannelMessages(
            channel.channelId,
            result.messages,
          );
          const labels: Record<string, string> = {};
          const hiddenKeys: string[] = [];

          for (const message of loadedMessages) {
            if (!remainingRootMessageIds.has(message.id)) continue;

            if (isThreadRootMessage(message)) {
              labels[message.id] = threadTitleFromMessage(message);
              remainingRootMessageIds.delete(message.id);
              continue;
            }

            hiddenKeys.push(threadRootLabelKey(channel.channelId, message.id));
            remainingRootMessageIds.delete(message.id);
          }

          if (Object.keys(labels).length > 0 && !cancelled) {
            setThreadRootLabels((current) => ({ ...current, ...labels }));
          }
          if (hiddenKeys.length > 0 && !cancelled) {
            setHiddenThreadRootLabelKeys((current) =>
              withThreadRootLabelKeys(current, hiddenKeys),
            );
          }

          if (!result.nextBeforeMessageId) break;

          beforeMessageId = result.nextBeforeMessageId;
        }

        for (const rootMessageId of remainingRootMessageIds) {
          unresolvedKeys.add(
            threadRootLabelKey(channel.channelId, rootMessageId),
          );
        }
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    community.id,
    projectChannelMessages,
    session,
    threadRootLabels,
    visibleTextChannels,
  ]);
  const visibleVoiceChannels = useMemo(() => {
    const query = channelSearch.trim().toLowerCase();
    const accessibleChannels = accessibleVoiceChannels.filter(
      (channel) =>
        channel.id === activeVoiceChannelId ||
        !NotificationSettingsPolicy.shouldHide(
          channelNotificationSetting(channel),
        ),
    );

    if (!query) return accessibleChannels;

    return accessibleChannels.filter((channel) =>
      channel.name.toLowerCase().includes(query),
    );
  }, [
    accessibleVoiceChannels,
    activeVoiceChannelId,
    channelNotificationSetting,
    channelSearch,
  ]);
  const historicalIdentityIds = useMemo(
    () =>
      communityMessageIdentityIds({
        messages: [
          ...messages,
          ...(threadPanel ? [threadPanel.root, ...threadPanel.messages] : []),
          ...(messageCollection?.messages ?? []),
          ...messageSearch.results.map((result) => result.message),
        ],
        polls: selectedChannelPolls,
      }),
    [
      messageCollection?.messages,
      messages,
      messageSearch.results,
      selectedChannelPolls,
      threadPanel,
    ],
  );
  const {
    communityMemberIds,
    memberIdentities,
    memberPictures,
    members,
    ownIdentityPictures,
    reactionAuthorNames,
    voiceParticipantsByChannelId,
  } = useCommunityMembers({
    activeCall,
    activeVoiceChannelId,
    community,
    extraIdentityIds: historicalIdentityIds,
    session,
    visibleVoiceChannels,
    voiceChannels,
  });
  const communityIdentityNames = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(memberIdentities).map(([identityId, identity]) => [
          identityId,
          memberDisplayName(identity, identityId),
        ]),
      ),
    [memberIdentities],
  );
  useEffect(() => {
    const knownRootLabels: Record<string, string> = {};
    const rememberRootLabel = (message: ChatMessage) => {
      if (!isThreadRootMessage(message)) return;

      knownRootLabels[message.id] = threadTitleFromMessage(message);
    };

    for (const message of messages) {
      rememberRootLabel(message);
    }

    if (threadPanel) {
      rememberRootLabel(threadPanel.root);
    }

    for (const message of messageCollection?.messages ?? []) {
      rememberRootLabel(message);
    }

    for (const result of messageSearch.results) {
      rememberRootLabel(result.message);
    }

    const entries = Object.entries(knownRootLabels);

    if (entries.length === 0) return;

    setThreadRootLabels((current) => {
      let changed = false;
      const next = { ...current };

      for (const [messageId, label] of entries) {
        if (next[messageId] === label) continue;

        next[messageId] = label;
        changed = true;
      }

      return changed ? next : current;
    });
  }, [
    messageCollection?.messages,
    messageSearch.results,
    messages,
    threadPanel,
  ]);
  const threadLabelByRootMessageId = useMemo(() => {
    const labels: Record<string, string> = { ...threadRootLabels };

    for (const message of messages) {
      if (isThreadRootMessage(message)) {
        labels[message.id] = threadTitleFromMessage(message);
      }
    }

    if (threadPanel) {
      labels[threadPanel.root.id] = threadTitleFromMessage(threadPanel.root);
    }

    return labels;
  }, [messages, threadPanel, threadRootLabels]);
  const {
    autocomplete: autocompleteMention,
    insert: insertMention,
    suggestions: mentionSuggestions,
    tokens: mentionTokens,
  } = useCommunityMentions({
    community,
    draft,
    identities: memberIdentities,
    members,
    permissions: currentPermissions,
    selectedChannel,
    setDraft: setSelectedChannelDraft,
  });
  const channelEncryptionReady =
    !!selectedChannel &&
    (communityIsPublic ||
      (!!communityKey &&
        communityMemberIds.every(
          (identityId) =>
            identityId === session.identity.id || memberIdentities[identityId],
        )));

  useEffect(
    () => () => {
      communityMessageDecryptWorkerRef.current?.terminate();
      communityMessageDecryptWorkerRef.current = null;

      for (const timer of draftSyncTimersRef.current.values()) {
        window.clearTimeout(timer);
      }

      draftSyncTimersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    void applicationContainer
      .listCommunityDrafts(session)
      .then((remoteDrafts) => {
        if (cancelled) return;

        setDrafts((current) => {
          const next = { ...current };

          for (const draft of remoteDrafts) {
            if (
              draft.communityId === community.id &&
              next[draft.channelId] === undefined
            ) {
              next[draft.channelId] = draft.content;
            }
          }

          return next;
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [community.id, session]);

  useEffect(() => {
    memberIdentitiesRef.current = memberIdentities;
  }, [memberIdentities]);

  useEffect(() => {
    onCommunityUpdatedRef.current = onCommunityUpdated;
  }, [onCommunityUpdated]);

  useEffect(() => {
    const pending = pendingSearchResultRef.current;

    if (pending) {
      if (
        selectedChannelId !== pending.channelId ||
        messageState === 'loading'
      ) {
        return;
      }

      setMessages((current) => mergeChatMessages(current, [pending.message]));
      scrollToChannelMessage(pending.message.id);
      pendingSearchResultRef.current = null;
    }

    const pendingFocusedMessage = pendingFocusedMessageRef.current;

    if (!pendingFocusedMessage) return;

    if (
      selectedChannelId !== pendingFocusedMessage.channelId ||
      messageState === 'loading'
    ) {
      return;
    }

    setMessages((current) =>
      mergeChatMessages(current, [pendingFocusedMessage.message]),
    );
    scrollToChannelMessage(pendingFocusedMessage.message.id);
    pendingFocusedMessageRef.current = null;
  }, [messageState, scrollToChannelMessage, selectedChannelId, setMessages]);

  const channelEncryptionTooltip = communityIsPublic
    ? copy.chat.publicChannel
    : channelEncryptionReady
      ? copy.chat.e2eReady
      : copy.chat.e2eMissing;
  const missingCommunityKey =
    !communityIsPublic &&
    !communityKey &&
    (!owner ||
      (visibleMessages.length > 0 &&
        visibleMessages.every((message) => message.encrypted)));

  const openMemberProfile = useCallback(
    (member: CommunityProfileView, anchor?: ProfilePopoverAnchor) =>
      setProfileViewer({ ...member, anchor }),
    [],
  );
  const joinVoiceChannel = useCallback(
    (channel: CommunityVoiceChannel) => {
      if (!currentPermissions.has('connect_voice')) return;

      onJoinVoiceChannel?.(channel);
    },
    [currentPermissions, onJoinVoiceChannel],
  );
  const openVoiceParticipantProfile = useCallback(
    (
      participant: {
        identityId: string;
        picture?: null | string;
      },
      event: MouseEvent<HTMLButtonElement>,
    ) =>
      openMemberProfile(
        {
          identity:
            participant.identityId === session.identity.id
              ? session.identity
              : memberIdentities[participant.identityId],
          identityId: participant.identityId,
          pictureUrl: participant.picture ?? null,
        },
        profileAnchorFromTarget(event.currentTarget),
      ),
    [memberIdentities, openMemberProfile, session.identity],
  );
  const openMessageAuthorProfile = (
    message: ChatMessage,
    anchor?: ProfilePopoverAnchor,
  ) => {
    const identityId = message.authorIdentityId;

    openMemberProfile(
      {
        identity:
          identityId === session.identity.id
            ? session.identity
            : memberIdentities[identityId],
        identityId,
        pictureUrl: memberPictures[identityId] ?? null,
      },
      anchor,
    );
  };
  const leaveCommunity = async () => {
    if (communityLeaving) return;

    if (!window.confirm(copy.communities.leaveConfirm)) return;

    setCommunityLeaving(true);
    setCommunityLeaveError(null);

    try {
      const result = await applicationContainer.leaveCommunity(
        session,
        community.id,
      );

      onSessionUpdated({
        ...session,
        keychain: result.keychain,
        keychainExternalIdentifier: result.keychainExternalIdentifier,
      });
      setCommunityMenuOpen(false);
      onCommunityLeft(result.community ?? community);
    } catch (caught) {
      setCommunityLeaveError(
        toUserErrorMessage(caught, copy.communities.leaveError),
      );
    } finally {
      setCommunityLeaving(false);
    }
  };
  const communityData = useMemo(
    () => ({
      frontendDerived: {
        channelEncryptionReady,
        communityId: community.id,
        communityName: community.name,
        loadedMessages: messages.length,
        memberCount: community.memberIds.length,
        networkId: community.networkId,
        networkName,
      },
      serverChannel: selectedChannel ?? null,
      serverCommunity: community,
    }),
    [
      channelEncryptionReady,
      community,
      messages.length,
      networkName,
      selectedChannel,
    ],
  );

  useEffect(() => {
    const nextSelectedChannel =
      accessibleTextChannels.find((channel) => channel.id === activeChannelId)
        ?.id ??
      accessibleTextChannels.find((channel) => channel.id === selectedChannelId)
        ?.id ??
      accessibleTextChannels[0]?.id ??
      null;

    setSelectedChannelId(nextSelectedChannel);

    if (nextSelectedChannel) onChannelSelected(nextSelectedChannel);
  }, [
    accessibleTextChannels,
    activeChannelId,
    onChannelSelected,
    selectedChannelId,
  ]);

  useEffect(() => {
    let cancelled = false;

    void applicationContainer
      .getCommunity(session, community.id)
      .then((freshCommunity) => {
        if (!cancelled) onCommunityUpdatedRef.current(freshCommunity);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [community.id, session]);

  useEffect(() => {
    const avatar = community.avatar?.trim();

    setAvatarUrl(null);
    setAvatarViewerOpen(false);

    if (!avatar) return undefined;

    let cancelled = false;

    void loadPublicImage(avatar).then((url) => {
      if (!cancelled) setAvatarUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.avatar]);

  useEffect(() => {
    const banner = community.banner?.trim();

    setBannerUrl(null);
    setBannerViewerOpen(false);

    if (!banner) return undefined;

    let cancelled = false;

    void loadPublicImage(banner).then((url) => {
      if (!cancelled) setBannerUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.banner]);

  const resolveMemberIdentities = useCallback(async () => {
    const cachedIdentities = memberIdentitiesRef.current;
    const entries = await Promise.all(
      community.memberIds.map(async (identityId) => {
        const cached =
          identityId === session.identity.id
            ? session.identity
            : cachedIdentities[identityId];

        if (cached) return [identityId, cached] as const;

        try {
          return [
            identityId,
            await applicationContainer.identities.get(
              IdentityId.normalize(identityId),
            ),
          ] as const;
        } catch {
          return [identityId, undefined] as const;
        }
      }),
    );
    const nextIdentities: Record<string, IdentityResource> = {};

    for (const [identityId, identity] of entries) {
      if (identity) nextIdentities[identityId] = identity;
    }

    return nextIdentities;
  }, [communityMemberIds, session.identity]);

  const handleStickerClick = (sticker: StickerMessageReference) => {
    setStickerPackPreview(sticker);
  };
  const upsertPoll = useCallback((poll: PollResource) => {
    setPolls((current) =>
      [...current.filter((item) => item.id !== poll.id), poll].sort(
        (left, right) => left.createdAt - right.createdAt,
      ),
    );
  }, []);
  const { closePoll, handleCreatePoll, removePollVote, votePoll } =
    useCommunityPollWorkflow({
      communityId: community.id,
      scrollToBottom: scrollChannelToBottom,
      selectedChannelId: selectedChannel?.id ?? null,
      session,
      upsertPoll,
    });
  const messageComposer = useCommunityMessageComposer({
    community,
    currentPermissions,
    draft,
    memberIdentities,
    messages,
    onTypingActive,
    owner,
    projectChannelMessage,
    scrollChannelToBottom,
    scrollerRef,
    selectedChannel,
    selectedChannelId,
    selectedChannelPolls,
    session,
    setDraft: setSelectedChannelDraft,
    setMessages,
  });
  const {
    applyRealtimeDeletion: handleRealtimeMessageDeleted,
    applyRealtimeEdit: handleRealtimeMessageEdited,
    cancelEditing: cancelThreadMessageEdit,
    cancelReplying: cancelThreadMessageReply,
    deleteMessage: deleteThreadMessage,
    editMessage: editThreadMessage,
    receiveRealtimeMessage: handleRealtimeThreadMessage,
    sendMessage: sendThreadMessage,
    sendSticker: sendThreadSticker,
    startEditing: startEditingThreadMessage,
    startReplying: startReplyingToThreadMessage,
    updateDraft: updateThreadDraft,
  } = useCommunityThreadActions({
    channelThreadsByChannelId,
    messageComposer,
    selectedChannelId,
    setMessageContextMenu,
    setMessages,
    setThreadPanel,
    threadPanel,
    upsertChannelThreadSummary,
  });
  const handleTextChannelSelected = useCallback(
    (channelId: string) => {
      const leavingThreadInCurrentChannel =
        !!threadPanel && channelId === selectedChannelId;

      setThreadPanel(null);
      handleChannelSelected(channelId);

      if (leavingThreadInCurrentChannel) {
        requestAnimationFrame(() => scrollChannelToBottom('auto', true));
      }
    },
    [
      handleChannelSelected,
      scrollChannelToBottom,
      selectedChannelId,
      threadPanel,
    ],
  );
  useEffect(() => {
    messageComposer.resetForChannelChange();
  }, [selectedChannelId]);

  useEffect(() => {
    if (!threadPanel || threadPanel.channelId === selectedChannelId) return;

    setThreadPanel(null);
  }, [selectedChannelId, threadPanel]);

  const shouldCountNewChannelMessage = useCallback(
    (channelId: string) =>
      !NotificationSettingsPolicy.isMuted(
        channelNotificationSetting({ id: channelId }),
      ),
    [channelNotificationSetting],
  );

  useCommunityChannelRealtime({
    communityId: community.id,
    incrementNewChannelMessageCount,
    isScrolledNearBottom,
    loadChannelMessages,
    onChannelViewed,
    onMessageDeleted: handleRealtimeMessageDeleted,
    onMessageEdited: handleRealtimeMessageEdited,
    onThreadMessageReceived: handleRealtimeThreadMessage,
    projectChannelMessage,
    realtimeEvent,
    resetNewChannelMessageCount,
    scrollChannelToBottom,
    selectedChannelId,
    session,
    shouldCountNewChannelMessage,
    setMessages,
    upsertPoll,
  });

  return (
    <>
      <CommunitySidebar
        activeCall={activeCall}
        activeVoiceChannelId={activeVoiceChannelId}
        animateEntries={animateSidePanelEntries}
        animationScopeKey={community.id}
        bannerUrl={bannerUrl}
        canManageCommunity={
          owner ||
          currentPermissions.has('manage_channels') ||
          currentPermissions.has('manage_roles') ||
          currentPermissions.has('ban_members')
        }
        channelSearch={channelSearch}
        channelUnreadCounts={channelUnreadCounts}
        community={community}
        communityIsPublic={communityIsPublic}
        mobileRail={mobileRail}
        mobileSidebarOpen={mobileSidebarOpen}
        nodeNetworks={nodeNetworks}
        onBannerOpen={() => setBannerViewerOpen(true)}
        onCallEnd={onCallEnd}
        onCallParticipantScreenShareVolumeChange={
          onCallParticipantScreenShareVolumeChange
        }
        onCallParticipantVolumeChange={onCallParticipantVolumeChange}
        onCallScreenShareQualityChange={onCallScreenShareQualityChange}
        onCallToggleCamera={onCallToggleCamera}
        onCallToggleDeafen={onCallToggleDeafen}
        onCallToggleMicrophone={onCallToggleMute}
        onCallToggleNoiseCancellation={onCallToggleNoiseCancellation}
        onCallRetryMicrophone={onCallRetryMicrophone}
        onCallToggleScreenShare={onCallToggleScreenShare}
        onChannelSearchChange={setChannelSearch}
        onManageOpen={() => setManageOpen(true)}
        onMobileSidebarClose={onMobileSidebarClose}
        onPresenceChange={onPresenceChange}
        onPresenceStatusSelected={onPresenceStatusSelected}
        onTextChannelSelected={handleTextChannelSelected}
        onTextChannelMuteToggle={(channel) =>
          onNotificationMuteToggle(channelNotificationScope(channel.id))
        }
        onTextChannelNotificationSettingsOpen={(channel) =>
          onNotificationSettingsOpen({
            scope: channelNotificationScope(channel.id),
            subtitle: community.name,
            title: `# ${channel.name}`,
          })
        }
        onThreadSelected={(channel, thread) =>
          void openMessageThreadFromSummary(channel.id, thread)
        }
        onVoiceChannelJoin={joinVoiceChannel}
        onVoiceParticipantClick={openVoiceParticipantProfile}
        onLogout={onLogout}
        onSessionUpdated={onSessionUpdated}
        ownIdentityPictures={ownIdentityPictures}
        presence={presenceByIdentityId[session.identity.id]}
        selectedChannelId={selectedChannelId}
        selectedThreadRootMessageId={threadPanel?.root.id}
        session={session}
        textChannels={textChannelsWithThreads}
        textChannelNotificationSetting={channelNotificationSetting}
        threadLabelByRootMessageId={threadLabelByRootMessageId}
        visibleTextChannels={visibleTextChannels}
        visibleVoiceChannels={visibleVoiceChannels}
        voiceChannelNotificationSetting={channelNotificationSetting}
        voiceChannels={voiceChannels}
        voiceParticipantsByChannelId={voiceParticipantsByChannelId}
      />

      <section className="app-safe-area-panel glass-panel-strong flex min-h-0 flex-col overflow-hidden rounded-none">
        <CommunityHeader
          avatarUrl={avatarUrl}
          channelEncryptionReady={channelEncryptionReady}
          channelEncryptionTooltip={channelEncryptionTooltip}
          channelPublic={communityIsPublic}
          community={community}
          communityLeaveError={communityLeaveError}
          communityMenuOpen={communityMenuOpen}
          menuContent={
            <CommunityHeaderActionsMenu
              communityLeaving={communityLeaving}
              hasCommunityKey={!!communityKey}
              notificationSetting={communityNotificationSetting}
              showCommunityKeyAction={!communityIsPublic}
              onAddMember={
                selectedChannel &&
                (owner || currentPermissions.has('create_invites'))
                  ? () => setMemberOpen(true)
                  : undefined
              }
              onClose={() => setCommunityMenuOpen(false)}
              onCommunityDataOpen={() => {
                setCommunityDataOpen(true);
                setCommunityMenuOpen(false);
              }}
              onCommunityKeyOpen={() => {
                if (communityKey) {
                  openCopyCommunityKeyDialog();
                } else {
                  openAddCommunityKeyDialog();
                }

                setCommunityMenuOpen(false);
              }}
              onLeaveCommunity={() => void leaveCommunity()}
              onNotificationMuteToggle={() =>
                onNotificationMuteToggle(communityNotificationScope)
              }
              onNotificationSettingsOpen={() =>
                onNotificationSettingsOpen({
                  scope: communityNotificationScope,
                  subtitle: networkName,
                  title: community.name,
                })
              }
              onOpenPins={
                selectedChannel ? showPinnedMessages : undefined
              }
              onRealtimeEventsOpen={onRealtimeEventsOpen}
              open={communityMenuOpen}
            />
          }
          networkName={networkName}
          onCommunityMenuToggle={() =>
            setCommunityMenuOpen((isOpen) => !isOpen)
          }
          onEncryptionDetailsOpen={() => setEncryptionDetailsOpen(true)}
          onOpenAvatar={avatarUrl ? () => setAvatarViewerOpen(true) : undefined}
          onOpenMobileSidebar={onOpenMobileSidebar}
          onPinsOpen={showPinnedMessages}
          onRealtimeEventsOpen={onRealtimeEventsOpen}
          realtimeStatus={realtimeStatus}
          selectedChannel={selectedChannel}
        >
          {communityIsPublic ? (
            <button
              className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-black text-white/70 transition hover:bg-white/15"
              onClick={() => messageSearch.setOpen(!messageSearch.open)}
              type="button"
            >
              {copy.communities.searchMessages}
            </button>
          ) : null}
        </CommunityHeader>

        {communityIsPublic && messageSearch.open ? (
          <CommunityMessageSearchPanel
            disabled={!selectedChannel && messageSearch.scope === 'channel'}
            error={messageSearch.error}
            onClose={() => messageSearch.setOpen(false)}
            onQueryChange={messageSearch.setQuery}
            onResultClick={messageSearch.onResultClick}
            onScopeChange={messageSearch.setScope}
            onSubmit={() => void messageSearch.submit()}
            query={messageSearch.query}
            results={messageSearch.results}
            searched={messageSearch.searched}
            scope={messageSearch.scope}
            state={messageSearch.state}
          />
        ) : null}

        {threadPanel ? (
          <MessageThreadPanel
            currentIdentityId={session.identity.id}
            disabled={
              threadPanel.state === 'loading' ||
              messageState === 'loading' ||
              (!communityIsPublic && !communityKey) ||
              !currentPermissions.has('send_messages')
            }
            draft={threadPanel.draft}
            editingMessage={threadPanel.editingMessage?.message ?? null}
            embedded
            error={threadPanel.error}
            identityNames={communityIdentityNames}
            identityPictures={memberPictures}
            messages={threadPanel.messages}
            onCancelEdit={cancelThreadMessageEdit}
            onCancelReply={cancelThreadMessageReply}
            onAuthorProfileOpen={(message, target) =>
              openMessageAuthorProfile(message, profileAnchorFromTarget(target))
            }
            onClose={() => setThreadPanel(null)}
            onDraftChange={updateThreadDraft}
            onEdit={editThreadMessage}
            onMessageMenuOpen={(message, x, y) =>
              setMessageContextMenu({ message, source: 'thread', x, y })
            }
            onRootMessageOpen={(message) => {
              pendingFocusedMessageRef.current = {
                channelId: threadPanel.channelId,
                message,
              };
              setMessages((current) => mergeChatMessages(current, [message]));
              handleChannelSelected(threadPanel.channelId);
              setThreadPanel(null);

              if (
                threadPanel.channelId === selectedChannelId &&
                messageState !== 'loading'
              ) {
                window.setTimeout(() => scrollToChannelMessage(message.id), 0);
              }
            }}
            onSend={sendThreadMessage}
            onStickerSend={
              currentPermissions.has('send_stickers')
                ? sendThreadSticker
                : undefined
            }
            pinnedMessageIds={pinnedMessageIds}
            replyTo={threadPanel.replyTarget}
            replyToAuthorName={
              threadPanel.replyTarget
                ? memberDisplayName(
                    memberIdentities[threadPanel.replyTarget.authorIdentityId],
                    threadPanel.replyTarget.authorIdentityId,
                  )
                : undefined
            }
            rootMessage={threadPanel.root}
            session={session}
            title={`# ${channelNameFor(threadPanel.channelId)}`}
          />
        ) : !selectedChannel ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div className="max-w-md">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-3xl font-black">
                #
              </div>
              <h2 className="mt-5 text-2xl font-black">
                {copy.communities.noChannelSelected}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/55">
                {copy.communities.noChannelSelectedBody}
              </p>
            </div>
          </div>
        ) : (
          <>
            <CommunityMessageTimeline
              bottomRef={bottomRef}
              isAwayFromBottom={isAwayFromBottom}
              loadAttachmentPreview={messageComposer.loadAttachmentPreview}
              memberIdentities={memberIdentities}
              memberPictures={memberPictures}
              messageCursor={messageCursor}
              messageState={messageState}
              missingCommunityKey={missingCommunityKey}
              invitationAccepting={invitationAccepting}
              invitationError={invitationError}
              invitationInviterName={invitationInviterName}
              newChannelMessageCount={newChannelMessageCount}
              onAddCommunityKey={() => {
                openAddCommunityKeyDialog();
              }}
              onInvitationAccept={onInvitationAccept}
              onAttachmentOpen={(attachment) =>
                void messageComposer.openAttachment(attachment)
              }
              onAuthorProfileOpen={(message, target) =>
                openMessageAuthorProfile(
                  message,
                  profileAnchorFromTarget(target),
                )
              }
              onIdentityProfileOpen={(identityId, target) =>
                openMemberProfile(
                  {
                    identity:
                      identityId === session.identity.id
                        ? session.identity
                        : memberIdentities[identityId],
                    identityId,
                    pictureUrl: memberPictures[identityId] ?? null,
                  },
                  profileAnchorFromTarget(target),
                )
              }
              onJumpToLatest={jumpToLatest}
              onMessageMenuOpen={(message, x, y) =>
                setMessageContextMenu({ message, x, y })
              }
              onOpenThread={(message) => void openMessageThread(message)}
              onReactionToggle={(message, emoji, reacted) =>
                void messageComposer.handleToggleChannelMessageReaction(
                  message,
                  emoji,
                  reacted,
                )
              }
              onReplyReferenceClick={messageComposer.handleReplyReferenceClick}
              onRetryMessage={messageComposer.retryChannelMessage}
              canClosePolls={currentPermissions.has('create_polls')}
              channelThreadSummaries={selectedChannel.threads ?? []}
              onPollClose={closePoll}
              onPollRemoveVote={removePollVote}
              onPollVote={votePoll}
              onScroll={handleMessagesScroll}
              onStickerClick={handleStickerClick}
              currentRoleIds={currentRoleIds}
              reactionAuthorNames={reactionAuthorNames}
              pendingInvitation={pendingInvitation}
              polls={selectedChannelPolls}
              pinnedMessageIds={pinnedMessageIds}
              scrollerRef={scrollerRef}
              session={session}
              visibleMessages={visibleMessages}
            />
            {typingIdentityIds.length > 0 && (
              <TypingIndicator
                getIdentityName={(identityId) =>
                  memberPrimaryName(memberIdentities[identityId], identityId)
                }
                identityIds={typingIdentityIds}
              />
            )}
            <Composer
              disabled={
                messageState === 'loading' ||
                (!communityIsPublic && !communityKey) ||
                !currentPermissions.has('send_messages')
              }
              defaultEncryptAttachments={!communityIsPublic}
              draft={draft}
              editingMessage={messageComposer.editingMessage}
              error={messageComposer.error}
              focusKey={`${selectedChannelId ?? 'no-channel'}:${
                messageComposer.editingMessage?.id ?? 'send'
              }`}
              onCancelEdit={messageComposer.cancelEditingChannelMessage}
              onCancelReply={messageComposer.clearReplyTarget}
              onDraftChange={messageComposer.handleDraftChange}
              onEdit={messageComposer.handleEditChannelMessage}
              onEscape={
                messageComposer.editingMessage
                  ? messageComposer.cancelEditingChannelMessage
                  : () => undefined
              }
              onSend={messageComposer.handleSendChannelMessage}
              onStickerSend={
                currentPermissions.has('send_stickers')
                  ? messageComposer.handleSendChannelSticker
                  : undefined
              }
              mentionHelper={
                mentionSuggestions.length > 0 ? (
                  <CommunityMentionPanel
                    onSelect={insertMention}
                    suggestions={mentionSuggestions}
                  />
                ) : null
              }
              mentionTokens={mentionTokens}
              onMentionAutocomplete={autocompleteMention}
              onPollCreate={
                currentPermissions.has('create_polls')
                  ? () => setPollDialogOpen(true)
                  : undefined
              }
              progress={messageComposer.attachmentProgress}
              replyTo={messageComposer.replyTarget}
              replyToAuthorName={
                messageComposer.replyTarget
                  ? memberDisplayName(
                      memberIdentities[
                        messageComposer.replyTarget.authorIdentityId
                      ],
                      messageComposer.replyTarget.authorIdentityId,
                    )
                  : undefined
              }
              session={session}
            />
            {stickerPackPreview && (
              <Suspense fallback={null}>
                <StickerPackPreviewDialog
                  onClose={() => setStickerPackPreview(null)}
                  onStickerSend={messageComposer.handleSendChannelSticker}
                  session={session}
                  sticker={stickerPackPreview}
                />
              </Suspense>
            )}
            {pollDialogOpen && (
              <Suspense fallback={null}>
                <CreatePollDialog
                  onClose={() => setPollDialogOpen(false)}
                  onSubmit={handleCreatePoll}
                />
              </Suspense>
            )}
          </>
        )}
      </section>

      <CommunityMembersPanel
        community={community}
        animateEntries={animateSidePanelEntries}
        animationScopeKey={community.id}
        canInvite={
          Boolean(selectedChannel) &&
          (owner || currentPermissions.has('create_invites'))
        }
        members={selectedChannel ? members : []}
        onAddMember={() => setMemberOpen(true)}
        onCloseMobile={onMobileMembersClose}
        onMemberClick={(member, event) =>
          openMemberProfile(
            member,
            profileAnchorFromTarget(event.currentTarget),
          )
        }
        openMobile={mobileMembersOpen}
        presenceByIdentityId={presenceByIdentityId}
      />

      {messageCollection ? (
        <MessageCollectionDialog
          actions={
            canManageMessages
              ? [
                  {
                    label: copy.messages.unpin,
                    onClick: (message) => void unpinMessageFromDialog(message),
                    tone: 'danger',
                  },
                ]
              : []
          }
          description={copy.messages.pinnedMessagesBody}
          emptyLabel={
            messageCollection.state === 'loading'
              ? copy.app.loading
              : (messageCollection.error ?? copy.messages.emptyPins)
          }
          identityNames={communityIdentityNames}
          identityPictures={memberPictures}
          messages={messageCollection.messages}
          onClose={closePinnedMessages}
          onMessageOpen={(message) => {
            closePinnedMessages();
            setMessages((current) => mergeChatMessages(current, [message]));
            scrollToChannelMessage(message.id);
          }}
          subtitle={messageCollection.error}
          title={copy.messages.pinnedMessages}
        />
      ) : null}

      <CommunityWorkspaceDialogs
        avatarUrl={avatarUrl}
        avatarViewerOpen={avatarViewerOpen}
        bannerUrl={bannerUrl}
        bannerViewerOpen={bannerViewerOpen}
        community={community}
        communityData={communityData}
        communityDataOpen={communityDataOpen}
        communityKeyDialog={communityKeyDialog}
        communityKeyEncrypted={communityKeyEncrypted}
        communityKeyError={communityKeyError}
        communityKeyInput={communityKeyInput}
        communityKeySaving={communityKeySaving}
        currentIdentityId={session.identity.id}
        currentPermissions={currentPermissions}
        encryptionDetails={
          encryptionDetailsOpen
            ? communityEncryptionDetails({
                channelEncryptionReady,
                community,
                communityIsPublic,
                communityKey,
                networkName,
                selectedChannel,
              })
            : null
        }
        manageOpen={manageOpen}
        memberOpen={memberOpen}
        messageContextMenu={messageContextMenu}
        nodeNetworks={nodeNetworks}
        onCloseAvatarViewer={() => setAvatarViewerOpen(false)}
        onCloseBannerViewer={() => setBannerViewerOpen(false)}
        onCloseCommunityData={() => setCommunityDataOpen(false)}
        onCloseEncryptionDetails={() => setEncryptionDetailsOpen(false)}
        onCloseCommunityKey={closeCommunityKeyDialog}
        onCloseManage={() => setManageOpen(false)}
        onCloseMember={() => setMemberOpen(false)}
        onCloseMessageContextMenu={() => setMessageContextMenu(null)}
        onCloseProfile={() => setProfileViewer(null)}
        onCloseRawMessage={() => setRawMessage(null)}
        onCommunityKeyCopy={() => void copyCommunityKey()}
        onCommunityKeyImport={() => void importCommunityKey()}
        onCommunityKeyInputChange={setCommunityKeyInput}
        onCommunityUpdated={onCommunityUpdated}
        onDeleteMessage={(message) =>
          void (messageContextMenu?.source === 'thread'
            ? deleteThreadMessage(message)
            : messageComposer.handleDeleteChannelMessage(message))
        }
        onDownloadAttachment={(attachment) =>
          void messageComposer.openAttachment(attachment)
        }
        onEditMessage={(message) =>
          messageContextMenu?.source === 'thread'
            ? startEditingThreadMessage(message)
            : messageComposer.startEditingChannelMessage(message)
        }
        onOpenConversationWithIdentity={onOpenConversationWithIdentity}
        onOpenMessageThread={(message) => void openMessageThread(message)}
        onPinMessage={(message) => void pinMessage(message)}
        onReplyToMessage={(message) => {
          if (messageContextMenu?.source === 'thread') {
            startReplyingToThreadMessage(message);

            return;
          }

          setMessageContextMenu(null);
          messageComposer.startReplyToMessage(message);
        }}
        onSessionUpdated={onSessionUpdated}
        onToggleReaction={(message, emoji, reacted) =>
          void messageComposer.handleToggleChannelMessageReaction(
            message,
            emoji,
            reacted,
          )
        }
        onViewRawMessage={(message) => {
          setRawMessage(message);
          setMessageContextMenu(null);
        }}
        onUnpinMessage={(message) => void unpinMessage(message)}
        owner={owner}
        presenceByIdentityId={presenceByIdentityId}
        pinnedMessageIds={pinnedMessageIds}
        profileViewer={profileViewer}
        rawMessage={rawMessage}
        session={session}
      />
    </>
  );
}
