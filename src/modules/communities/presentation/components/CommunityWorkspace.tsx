import {
  EncryptedPayload,
  PrivateKey,
  PublicKey,
  StringValueObject,
} from '@haskou/value-objects';
import {
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
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
  AttachmentUploadOptions,
  CommunityChannelThreadSummary,
  CommunityVoiceChannel,
  ConversationKeyEntry,
  ChatMessage,
  IdentityPresence,
  IdentityResource,
  MessageResource,
  PollResource,
  SelectablePresenceStatus,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/realtimeGateway';
import type { MessageContextMenuState } from '../../../../app/presentation/workspace/components/messageContextMenu';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { CommunityChannels } from '../../domain/CommunityChannels';
import { CommunityMessageDecryptWorkerClient } from '../../infrastructure/crypto/CommunityMessageDecryptWorkerClient';
import { CommunityAccessPolicy } from '../../domain/CommunityAccessPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { Composer } from '../../../messages/presentation/components/Composer';
import { MessageCollectionDialog } from '../../../messages/presentation/components/MessageCollectionDialog';
import { MessageThreadPanel } from '../../../messages/presentation/components/MessageThreadPanel';
import { CreatePollDialog } from '../../../polls/presentation/components/CreatePollDialog';
import { StickerPackPreviewDialog } from '../../../stickers/presentation/components/StickerPackPreviewDialog';
import { TypingIndicator } from '../../../messages/presentation/components/TypingIndicator';
import {
  profileAnchorFromTarget,
  type ProfilePopoverAnchor,
} from '../../../identities/presentation/view-models/profilePopoverAnchor';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { UserProfileDropdown } from '../../../../app/presentation/workspace/components/UserProfileDropdown';
import { CommunityChannelList } from './CommunityChannelList';
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
import {
  CommunityMentionPanel,
  type CommunityMentionSuggestion,
} from './communityMentionPanel';
import {
  mergeChatMessages,
  resolveCommunityChannelId,
} from './communityWorkspaceHelpers';
import { useCommunityMembers } from './useCommunityMembers';
import { CommunityMessageMentions } from './CommunityMessageMentions';
import { useCommunityChannelMessages } from './useCommunityChannelMessages';
import { useCommunityChannelRealtime } from './useCommunityChannelRealtime';
import { useCommunityMessageComposer } from './useCommunityMessageComposer';
import { useCommunityPollWorkflow } from './useCommunityPollWorkflow';
import { useCommunityMessageSearch } from './useCommunityMessageSearch';
import { communityMessageIdentityIds } from './communityMessageIdentityIds';

interface CommunityWorkspaceProps {
  activeChannelId?: null | string;
  activeCall?: CallSession | null;
  channelUnreadCounts?: Record<string, number>;
  community: Community;
  mobileMembersOpen: boolean;
  mobileSidebarOpen: boolean;
  mobileRail?: ReactNode;
  nodeNetworks: NodeNetwork[];
  presenceByIdentityId?: Record<string, IdentityPresence>;
  onChannelSelected: (channelId: string) => void;
  onChannelViewed?: (channelId: string) => void;
  onCommunityLeft: (community: Community) => void;
  onCommunityUpdated: (community: Community) => void;
  onCallEnd?: () => void;
  onCallParticipantVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallParticipantScreenShareVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallToggleCamera?: () => void;
  onCallToggleDeafen?: () => void;
  onCallToggleMute?: () => void;
  onCallToggleNoiseCancellation?: () => void;
  onCallToggleScreenShareAudio?: () => void;
  onCallToggleScreenShare?: () => void;
  onLogout: () => void;
  onPresenceChange?: (presence: IdentityPresence) => void;
  onPresenceStatusSelected?: (status: SelectablePresenceStatus) => void;
  onMobileMembersClose: () => void;
  onMobileSidebarClose: () => void;
  onOpenMobileSidebar: () => void;
  onJoinVoiceChannel?: (channel: CommunityVoiceChannel) => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
  ) => Promise<void>;
  onRealtimeEventsOpen?: () => void;
  onSessionUpdated: (session: Session) => void;
  onTypingActive?: (channelId: string, active: boolean) => void;
  realtimeEvent?: null | RealtimeDomainEvent;
  realtimeStatus?: 'connected' | 'reconnecting';
  session: Session;
  typingIdentityIds?: string[];
}

type MessageCollectionState = {
  error: null | string;
  messages: ChatMessage[];
  state: 'loading' | 'ready';
};

type CommunityThreadState = MessageCollectionState & {
  channelId: string;
  draft: string;
  editingMessage: CommunityThreadEditingMessage | null;
  root: ChatMessage;
};

type CommunityThreadEditingMessage = {
  message: ChatMessage;
  previousDraft: string;
};

export function CommunityWorkspace({
  activeCall,
  activeChannelId,
  channelUnreadCounts = {},
  community,
  mobileMembersOpen,
  mobileRail,
  mobileSidebarOpen,
  nodeNetworks,
  onCallEnd,
  onCallParticipantScreenShareVolumeChange,
  onCallParticipantVolumeChange,
  onCallToggleCamera,
  onCallToggleDeafen,
  onCallToggleMute,
  onCallToggleNoiseCancellation,
  onCallToggleScreenShareAudio,
  onCallToggleScreenShare,
  onChannelSelected,
  onChannelViewed,
  onCommunityLeft,
  onCommunityUpdated,
  onJoinVoiceChannel,
  onLogout,
  onMobileMembersClose,
  onMobileSidebarClose,
  onOpenConversationWithIdentity,
  onOpenMobileSidebar,
  onPresenceChange,
  onPresenceStatusSelected,
  onRealtimeEventsOpen,
  onSessionUpdated,
  onTypingActive,
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
  const [communityKeyDialog, setCommunityKeyDialog] = useState<
    'add' | 'copy' | null
  >(null);
  const [communityKeyEncrypted, setCommunityKeyEncrypted] = useState('');
  const [communityKeyError, setCommunityKeyError] = useState<string | null>(
    null,
  );
  const [communityKeyInput, setCommunityKeyInput] = useState('');
  const [communityKeySaving, setCommunityKeySaving] = useState(false);
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
  const [messageCollection, setMessageCollection] =
    useState<MessageCollectionState | null>(null);
  const [threadPanel, setThreadPanel] = useState<CommunityThreadState | null>(
    null,
  );
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [channelThreadsByChannelId, setChannelThreadsByChannelId] = useState<
    Record<string, CommunityChannelThreadSummary[]>
  >({});
  const [polls, setPolls] = useState<PollResource[]>([]);
  const [pollDialogOpen, setPollDialogOpen] = useState(false);

  useCloseOnEscape(onMobileSidebarClose, mobileSidebarOpen);
  const memberIdentitiesRef = useRef<Record<string, IdentityResource>>({});
  const onCommunityUpdatedRef = useRef(onCommunityUpdated);
  const communityMessageDecryptWorkerRef =
    useRef<CommunityMessageDecryptWorkerClient | null>(null);
  const pendingSearchResultRef =
    useRef<CommunityMessageSearchResultItem | null>(null);
  const communityKey = session.keychain.conversations[community.id];
  const communityIsPublic = community.visibility === 'public';
  const textChannelsWithThreads = useMemo(
    () =>
      textChannels.map((channel) => ({
        ...channel,
        threads:
          channelThreadsByChannelId[channel.id] ?? channel.threads ?? [],
      })),
    [channelThreadsByChannelId, textChannels],
  );
  useEffect(() => {
    let cancelled = false;

    void applicationContainer
      .listCommunityChannels(session, community.id)
      .then((channels) => {
        if (cancelled) return;

        setChannelThreadsByChannelId(
          Object.fromEntries(
            channels
              .filter((channel) => channel.type === 'text')
              .map((channel) => [channel.id, channel.threads ?? []]),
          ),
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [community.id, session]);
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
  });
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
        const value =
          typeof next === 'function' ? next(currentValue) : next;

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
        ?.name ??
      shortId(channelId),
    [textChannelsWithThreads],
  );
  const scrollToChannelMessage = useCallback(
    (messageId: string) => {
      requestAnimationFrame(() => {
        const element = scrollerRef.current?.querySelector<HTMLElement>(
          `[data-message-id="${CSS.escape(messageId)}"]`,
        );

        if (!element) return;

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusTarget =
          element.querySelector<HTMLElement>('[data-message-bubble]') ??
          element;

        focusTarget.classList.add('message-focus-ring');
        window.setTimeout(
          () => focusTarget.classList.remove('message-focus-ring'),
          1600,
        );
      });
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
  const openMessageThread = useCallback(
    async (message: ChatMessage) => {
      const channelId = message.raw.channelId ?? selectedChannelId;

      if (!channelId || !canManageMessages) return;

      if (channelId !== selectedChannelId) handleChannelSelected(channelId);

      setMessageContextMenu(null);
      setThreadPanel({
        channelId,
        draft: '',
        editingMessage: null,
        error: null,
        messages: [],
        root: message,
        state: 'loading',
      });
      try {
        const result =
          await applicationContainer.listCommunityChannelMessageThread(
            session,
            community.id,
            channelId,
            message.id,
          );
        const threadMessages = await projectChannelMessages(
          channelId,
          result.messages,
        );

        setThreadPanel({
          channelId,
          draft: '',
          editingMessage: null,
          error: null,
          messages: threadMessages,
          root: message,
          state: 'ready',
        });
        if (threadMessages.length > 0) {
          const lastReply = threadMessages[threadMessages.length - 1];

          upsertChannelThreadSummary(channelId, {
            lastReplyAt: lastReply.timestamp,
            lastReplyMessageId: lastReply.id,
            replyCount: threadMessages.length,
            rootMessageId: message.id,
          });
        }
      } catch (caught) {
        setThreadPanel({
          channelId,
          draft: '',
          editingMessage: null,
          error: toUserErrorMessage(caught, copy.messages.threadError),
          messages: [],
          root: message,
          state: 'ready',
        });
      }
    },
    [
      community.id,
      handleChannelSelected,
      projectChannelMessages,
      selectedChannelId,
      session,
      upsertChannelThreadSummary,
    ],
  );
  const openMessageThreadFromSummary = useCallback(
    async (
      channelId: string,
      threadSummary: CommunityChannelThreadSummary,
    ) => {
      const root =
        messages.find((message) => message.id === threadSummary.rootMessageId) ??
        placeholderThreadRootMessage({
          channelId,
          communityId: community.id,
          currentIdentityId: session.identity.id,
          rootMessageId: threadSummary.rootMessageId,
        });

      await openMessageThread(root);
    },
    [community.id, messages, openMessageThread, session.identity.id],
  );
  const openPinnedMessages = useCallback(async () => {
    if (!selectedChannelId) return;

    setCommunityMenuOpen(false);
    setMessageCollection({
      error: null,
      messages: [],
      state: 'loading',
    });
    try {
      const result = await applicationContainer.listCommunityChannelMessagePins(
        session,
        community.id,
        selectedChannelId,
      );
      const pinnedMessages = await projectChannelMessages(
        selectedChannelId,
        result.pins.map((pin) => pin.message),
      );

      setPinnedMessageIds(new Set(result.pins.map((pin) => pin.messageId)));
      setMessageCollection({
        error: null,
        messages: pinnedMessages,
        state: 'ready',
      });
    } catch (caught) {
      setMessageCollection({
        error: toUserErrorMessage(caught, copy.messages.pinError),
        messages: [],
        state: 'ready',
      });
    }
  }, [community.id, projectChannelMessages, selectedChannelId, session]);
  useEffect(() => {
    if (!selectedChannelId) {
      setPinnedMessageIds(new Set());

      return;
    }

    let cancelled = false;

    void applicationContainer
      .listCommunityChannelMessagePins(session, community.id, selectedChannelId)
      .then((result) => {
        if (!cancelled) {
          setPinnedMessageIds(new Set(result.pins.map((pin) => pin.messageId)));
        }
      })
      .catch(() => {
        if (!cancelled) setPinnedMessageIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [community.id, selectedChannelId, session]);
  useEffect(() => {
    if (!realtimeEvent || realtimeEvent.aggregate_id !== community.id) return;

    if (
      realtimeEvent.type !== 'communities.v1.channel.message.was_pinned' &&
      realtimeEvent.type !== 'communities.v1.channel.message.was_unpinned'
    ) {
      return;
    }

    const channelId =
      typeof realtimeEvent.attributes.channelId === 'string'
        ? realtimeEvent.attributes.channelId
        : null;
    const messageId =
      typeof realtimeEvent.attributes.messageId === 'string'
        ? realtimeEvent.attributes.messageId
        : null;

    if (!messageId || channelId !== selectedChannelId) return;

    setPinnedMessageIds((current) => {
      const next = new Set(current);

      if (realtimeEvent.type.endsWith('.was_pinned')) {
        next.add(messageId);
      } else {
        next.delete(messageId);
      }

      return next;
    });
  }, [community.id, realtimeEvent, selectedChannelId]);
  const pinMessage = useCallback(
    async (message: ChatMessage) => {
      const channelId = message.raw.channelId ?? selectedChannelId;

      if (!channelId) return;

      setMessageContextMenu(null);
      try {
        await applicationContainer.pinCommunityChannelMessage(
          session,
          community.id,
          channelId,
          message.id,
        );
        setPinnedMessageIds((current) => new Set(current).add(message.id));
      } catch (caught) {
        setRawMessage(null);
        setMessageCollection({
          error: toUserErrorMessage(caught, copy.messages.pinError),
          messages: [],
          state: 'ready',
        });
      }
    },
    [canManageMessages, community.id, selectedChannelId, session],
  );
  const unpinMessageFromDialog = useCallback(
    async (message: ChatMessage) => {
      const channelId = message.raw.channelId ?? selectedChannelId;

      if (!channelId || !canManageMessages) return;

      try {
        await applicationContainer.unpinCommunityChannelMessage(
          session,
          community.id,
          channelId,
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
    },
    [canManageMessages, community.id, selectedChannelId, session],
  );
  const unpinMessage = useCallback(
    async (message: ChatMessage) => {
      setMessageContextMenu(null);
      await unpinMessageFromDialog(message);
    },
    [unpinMessageFromDialog],
  );
  const activeVoiceChannelId =
    activeCall?.kind === 'community-voice' &&
    activeCall.communityId === community.id
      ? (activeCall.channelId ?? null)
      : null;
  const visibleTextChannels = useMemo(() => {
    const query = channelSearch.trim().toLowerCase();
    const accessibleChannels = accessibleTextChannels.map(
      (channel) =>
        textChannelsWithThreads.find((item) => item.id === channel.id) ??
        channel,
    );

    if (!query) return accessibleChannels;

    return accessibleChannels.filter((channel) =>
      channel.name.toLowerCase().includes(query),
    );
  }, [accessibleTextChannels, channelSearch, textChannelsWithThreads]);
  const visibleVoiceChannels = useMemo(() => {
    const query = channelSearch.trim().toLowerCase();

    if (!query) return accessibleVoiceChannels;

    return accessibleVoiceChannels.filter((channel) =>
      channel.name.toLowerCase().includes(query),
    );
  }, [accessibleVoiceChannels, channelSearch]);
  const historicalIdentityIds = useMemo(
    () =>
      communityMessageIdentityIds({
        messages: [
          ...messages,
          ...(threadPanel
            ? [threadPanel.root, ...threadPanel.messages]
            : []),
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
  const threadLabelByRootMessageId = useMemo(() => {
    const labels: Record<string, string> = {};

    for (const message of messages) {
      if (!message.replyToMessageId) {
        labels[message.id] = threadTitleFromMessage(message);
      }
    }

    if (threadPanel) {
      labels[threadPanel.root.id] = threadTitleFromMessage(threadPanel.root);
    }

    return labels;
  }, [messages, threadPanel]);
  const mentionSuggestions = useMemo(() => {
    if (!selectedChannel) return [];

    const trigger = findMentionTrigger(draft);

    if (!trigger) return [];

    const query = trigger.query.toLowerCase();
    const accessibleMemberIds = new Set(
      CommunityAccessPolicy.membersWithChannelAccess(
        community,
        selectedChannel,
      ),
    );
    const memberSuggestions = members
      .filter((member) => accessibleMemberIds.has(member.identityId))
      .map((member) => {
        const label = memberDisplayName(member.identity, member.identityId);
        const handle = member.identity?.profile.handle?.trim();

        return {
          description: handle ? `@${handle}` : copy.composer.identityMention,
          id: member.identityId,
          label,
          mention: { targetId: member.identityId, type: 'identity' } as const,
          token: `@${handle || label}`,
        };
      })
      .filter((suggestion) =>
        `${suggestion.label} ${suggestion.description}`
          .toLowerCase()
          .includes(query),
      );
    const roleSuggestions =
      currentPermissions.has('mention_roles') && community.roles
        ? community.roles
            .filter(
              (role) =>
                !role.builtIn && role.name.toLowerCase().includes(query),
            )
            .map((role) => ({
              description: copy.composer.roleMention,
              id: role.id,
              label: role.name,
              mention: { targetId: role.id, type: 'role' } as const,
              token: `@${role.name}`,
            }))
        : [];
    const specialSuggestionCandidates: Array<CommunityMentionSuggestion | null> =
      [
        currentPermissions.has('mention_everyone')
          ? {
              description: copy.composer.everyoneMention,
              id: 'everyone',
              label: 'everyone',
              mention: { type: 'everyone' } as const,
              token: '@everyone',
            }
          : null,
        currentPermissions.has('mention_here')
          ? {
              description: copy.composer.hereMention,
              id: 'here',
              label: 'here',
              mention: { type: 'here' } as const,
              token: '@here',
            }
          : null,
      ];
    const specialSuggestions = specialSuggestionCandidates.filter(
      (suggestion): suggestion is CommunityMentionSuggestion =>
        Boolean(suggestion && suggestion.label.includes(query)),
    );

    return [
      ...specialSuggestions,
      ...roleSuggestions,
      ...memberSuggestions,
    ].slice(0, 8);
  }, [community, currentPermissions, draft, members, selectedChannel]);
  const insertMention = useCallback(
    (token: string) => {
      const trigger = findMentionTrigger(draft);

      if (!trigger) return;

      setSelectedChannelDraft(
        `${draft.slice(0, trigger.start)}${token} ${draft.slice(trigger.end)}`,
      );
    },
    [draft, setSelectedChannelDraft],
  );
  const mentionTokens = useMemo(
    () =>
      selectedChannel
        ? CommunityMessageMentions.tokens({
            channel: selectedChannel,
            community,
            identities: memberIdentities,
            permissions: currentPermissions,
          })
        : [],
    [community, currentPermissions, memberIdentities, selectedChannel],
  );
  const autocompleteMention = useCallback(() => {
    const suggestion = mentionSuggestions[0];

    if (!suggestion) return false;

    insertMention(suggestion.token);

    return true;
  }, [insertMention, mentionSuggestions]);
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

        setDrafts((current) => ({
          ...current,
          ...Object.fromEntries(
            remoteDrafts
              .filter((draft) => draft.communityId === community.id)
              .map((draft) => [draft.channelId, draft.content]),
          ),
        }));
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

    if (
      !pending ||
      selectedChannelId !== pending.channelId ||
      messageState === 'loading'
    ) {
      return;
    }

    setMessages((current) => mergeChatMessages(current, [pending.message]));
    scrollToChannelMessage(pending.message.id);
    pendingSearchResultRef.current = null;
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
  const closeCommunityKeyDialog = () => {
    setCommunityKeyDialog(null);
    setCommunityKeyEncrypted('');
    setCommunityKeyError(null);
    setCommunityKeyInput('');
    setCommunityKeySaving(false);
  };
  const openCopyCommunityKeyDialog = () => {
    if (!communityKey) {
      setCommunityKeyError(copy.chat.copyPrivateKeyUnavailable);
      setCommunityKeyDialog('copy');

      return;
    }

    try {
      const encrypted = PublicKey.fromPEM(
        session.identity.encryptedKeyPair.publicKey,
      )
        .encrypt(JSON.stringify(communityKey))
        .toString();

      setCommunityKeyEncrypted(encrypted);
      setCommunityKeyError(null);
    } catch {
      setCommunityKeyError(copy.chat.copyPrivateKeyError);
    }

    setCommunityKeyDialog('copy');
  };
  const importCommunityKey = async () => {
    const encryptedPayload = communityKeyInput.trim();

    if (!encryptedPayload) {
      setCommunityKeyError(copy.chat.addPrivateKeyRequired);

      return;
    }

    setCommunityKeySaving(true);
    setCommunityKeyError(null);

    try {
      const decrypted = await session.encryptedKeyPair.decrypt(
        new EncryptedPayload(encryptedPayload),
        session.password,
      );
      const parsed = JSON.parse(
        decrypted.toString(),
      ) as Partial<ConversationKeyEntry>;

      if (
        !parsed.conversationId ||
        new StringValueObject(
          parsed.conversationId,
          Number.MAX_SAFE_INTEGER,
        ).isNotEqual(
          new StringValueObject(community.id, Number.MAX_SAFE_INTEGER),
        ) ||
        !parsed.privateKey
      ) {
        throw new Error(copy.chat.addPrivateKeyError);
      }

      const privateKey = PrivateKey.fromPEM(parsed.privateKey);
      const keyEntry: ConversationKeyEntry = {
        conversationId: community.id,
        createdAt: parsed.createdAt ?? Date.now(),
        peerIdentityId: parsed.peerIdentityId ?? session.identity.id,
        privateKey: privateKey.toString(),
        publicKey: parsed.publicKey ?? privateKey.getPublicKey().toString(),
      };
      const published = await applicationContainer.publishKeychain(session, {
        ...session.keychain,
        conversations: {
          ...session.keychain.conversations,
          [community.id]: keyEntry,
        },
      });

      onSessionUpdated({
        ...session,
        keychain: published.keychain,
        keychainExternalIdentifier: published.keychainExternalIdentifier,
      });
      closeCommunityKeyDialog();
    } catch {
      setCommunityKeyError(copy.chat.addPrivateKeyError);
    } finally {
      setCommunityKeySaving(false);
    }
  };
  const copyCommunityKey = async () => {
    if (navigator.clipboard && communityKeyEncrypted) {
      await navigator.clipboard.writeText(communityKeyEncrypted);
    }
  };
  const leaveCommunity = async () => {
    if (communityLeaving) return;

    if (!window.confirm(copy.communities.leaveConfirm)) return;

    setCommunityLeaving(true);
    setCommunityLeaveError(null);

    try {
      const updatedCommunity = await applicationContainer.leaveCommunity(
        session,
        community.id,
      );

      setCommunityMenuOpen(false);
      onCommunityLeft(updatedCommunity);
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
            await applicationContainer.getIdentity(
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
  const updateThreadDraft = useCallback((value: string) => {
    setThreadPanel((current) =>
      current ? { ...current, draft: value } : current,
    );
  }, []);
  const startEditingThreadMessage = useCallback((message: ChatMessage) => {
    setMessageContextMenu(null);
    setThreadPanel((current) =>
      current
        ? {
            ...current,
            draft: message.content,
            editingMessage: {
              message,
              previousDraft: current.draft,
            },
          }
        : current,
    );
  }, []);
  const cancelThreadMessageEdit = useCallback(() => {
    setThreadPanel((current) =>
      current
        ? {
            ...current,
            draft: current.editingMessage?.previousDraft ?? '',
            editingMessage: null,
          }
        : current,
    );
  }, []);
  const editThreadMessage = useCallback(
    async (content: string) => {
      if (!threadPanel?.editingMessage) return;

      const targetMessage = threadPanel.editingMessage.message;

      setThreadPanel((current) =>
        current ? { ...current, error: null } : current,
      );
      try {
        const projected = await messageComposer.editChannelMessage(
          targetMessage,
          content,
        );

        setMessages((current) =>
          current.some((message) => message.id === projected.id)
            ? mergeChatMessages(current, [projected])
            : current,
        );
        setThreadPanel((current) =>
          current
            ? {
                ...mergeCommunityThreadMessage(current, projected),
                draft: '',
                editingMessage: null,
                error: null,
              }
            : current,
        );
      } catch (caught) {
        setThreadPanel((current) =>
          current
            ? {
                ...current,
                error: toUserErrorMessage(caught, copy.messages.editError),
              }
            : current,
        );
      }
    },
    [messageComposer, setMessages, threadPanel],
  );
  const deleteThreadMessage = useCallback(
    async (message: ChatMessage) => {
      if (!window.confirm(copy.messages.deleteConfirm)) return;

      setMessageContextMenu(null);
      setThreadPanel((current) =>
        current ? { ...current, error: null } : current,
      );
      try {
        const deleted = await messageComposer.deleteChannelMessage(message);

        if (!deleted) return;

        setMessages((current) =>
          current.filter((item) => item.id !== message.id),
        );
        setThreadPanel((current) => {
          if (!current) return current;

          return removeCommunityThreadMessage(current, message.id);
        });
      } catch (caught) {
        setThreadPanel((current) =>
          current
            ? {
                ...current,
                error: toUserErrorMessage(caught, copy.messages.deleteError),
              }
            : current,
        );
      }
    },
    [messageComposer, setMessages],
  );
  const sendThreadMessage = useCallback(
    async (
      content: string,
      attachments: File[],
      attachmentUpload: AttachmentUploadOptions,
    ) => {
      if (!threadPanel) return;

      const sent = await messageComposer.sendReplyToMessage(
        threadPanel.root,
        content,
        attachments,
        attachmentUpload,
        { renderInChannel: false },
      );

      if (!sent) return;

      setThreadPanel((current) =>
        current
          ? {
              ...current,
              draft: '',
              messages: mergeChatMessages(current.messages, [sent]),
            }
          : current,
      );
      upsertChannelThreadSummary(threadPanel.channelId, {
        lastReplyAt: sent.timestamp,
        lastReplyMessageId: sent.id,
        replyCount: threadPanel.messages.some(
          (message) => message.id === sent.id,
        )
          ? threadPanel.messages.length
          : threadPanel.messages.length + 1,
        rootMessageId: threadPanel.root.id,
      });
    },
    [messageComposer, threadPanel, upsertChannelThreadSummary],
  );
  const sendThreadSticker = useCallback(
    async (sticker: StickerMessageReference) => {
      if (!threadPanel) return;

      const sent = await messageComposer.sendStickerReplyToMessage(
        threadPanel.root,
        sticker,
        { renderInChannel: false },
      );

      if (!sent) return;

      setThreadPanel((current) =>
        current
          ? {
              ...current,
              draft: '',
              messages: mergeChatMessages(current.messages, [sent]),
            }
          : current,
      );
      upsertChannelThreadSummary(threadPanel.channelId, {
        lastReplyAt: sent.timestamp,
        lastReplyMessageId: sent.id,
        replyCount: threadPanel.messages.some(
          (message) => message.id === sent.id,
        )
          ? threadPanel.messages.length
          : threadPanel.messages.length + 1,
        rootMessageId: threadPanel.root.id,
      });
    },
    [messageComposer, threadPanel, upsertChannelThreadSummary],
  );

  useEffect(() => {
    messageComposer.resetForChannelChange();
  }, [selectedChannelId]);

  useEffect(() => {
    if (!threadPanel || threadPanel.channelId === selectedChannelId) return;

    setThreadPanel(null);
  }, [selectedChannelId, threadPanel]);

  const handleRealtimeThreadMessage = useCallback(
    (message: ChatMessage) => {
      const channelId = message.raw.channelId ?? selectedChannelId;
      const rootMessageId = message.replyToMessageId;

      if (!channelId || !rootMessageId) return;

      const currentSummary = channelThreadsByChannelId[channelId]?.find(
        (thread) => thread.rootMessageId === rootMessageId,
      );

      setThreadPanel((current) =>
        current?.channelId === channelId && current.root.id === rootMessageId
          ? {
              ...current,
              messages: mergeChatMessages(current.messages, [message]),
            }
          : current,
      );
      upsertChannelThreadSummary(channelId, {
        lastReplyAt: message.timestamp,
        lastReplyMessageId: message.id,
        replyCount: currentSummary
          ? currentSummary.replyCount +
            (currentSummary.lastReplyMessageId === message.id ? 0 : 1)
          : 1,
        rootMessageId,
      });
    },
    [channelThreadsByChannelId, selectedChannelId, upsertChannelThreadSummary],
  );

  const handleRealtimeMessageEdited = useCallback((message: ChatMessage) => {
    setThreadPanel((current) =>
      current ? mergeCommunityThreadMessage(current, message) : current,
    );
  }, []);

  const handleRealtimeMessageDeleted = useCallback((messageId: string) => {
    setThreadPanel((current) =>
      current ? removeCommunityThreadMessage(current, messageId) : current,
    );
  }, []);

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
    setMessages,
    upsertPoll,
  });

  return (
    <>
      {mobileSidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onMobileSidebarClose}
          aria-label={copy.workspace.closeSidebar}
        />
      )}
      <aside
        className={cx(
          'app-safe-area-drawer-until-lg app-safe-area-drawer-flush fixed inset-y-0 left-0 z-40 w-[92vw] max-w-[430px] p-0 transition sm:w-[calc(86vw+82px)] sm:max-w-[442px] lg:static lg:z-auto lg:block lg:w-auto lg:max-w-none',
          mobileSidebarOpen ? 'block' : 'hidden lg:block',
        )}
      >
        <div className="grid h-full grid-cols-[82px_minmax(0,1fr)] gap-0 lg:block">
          <div className="lg:hidden">{mobileRail}</div>
          <div className="glass-panel-strong flex h-full min-h-0 flex-col rounded-none p-4">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {communityIsPublic
                  ? copy.communities.publicCommunity
                  : copy.communities.privateCommunity}
              </div>
              <div className="mt-3 overflow-hidden rounded-2xl bg-white/8 text-left">
                {bannerUrl ? (
                  <button
                    type="button"
                    onClick={() => setBannerViewerOpen(true)}
                    className="grid h-32 w-full place-items-center overflow-hidden bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-5xl font-black text-slate-950 transition hover:brightness-110"
                    aria-label={copy.communities.openBanner}
                  >
                    <img
                      src={bannerUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="grid h-32 place-items-center overflow-hidden bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-5xl font-black text-slate-950">
                    {community.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="p-4">
                  <h2 className="truncate text-xl font-black">
                    {community.name}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/55">
                    {community.description}
                  </p>
                  {(owner ||
                    currentPermissions.has('manage_channels') ||
                    currentPermissions.has('manage_roles') ||
                    currentPermissions.has('ban_members')) && (
                    <button
                      type="button"
                      onClick={() => setManageOpen(true)}
                      className="mt-4 w-full rounded-2xl bg-fuchsia-500 px-4 py-3 text-sm font-black text-white shadow-xl shadow-fuchsia-950/20 transition hover:bg-fuchsia-400"
                    >
                      {copy.communities.manage}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <CommunityChannelList
              activeVoiceChannelId={activeVoiceChannelId}
              channelSearch={channelSearch}
              channelUnreadCounts={channelUnreadCounts}
              onChannelSearchChange={setChannelSearch}
              onTextChannelSelected={handleTextChannelSelected}
              onThreadSelected={(channel, thread) =>
                void openMessageThreadFromSummary(channel.id, thread)
              }
              onVoiceChannelJoin={joinVoiceChannel}
              onVoiceParticipantClick={openVoiceParticipantProfile}
              selectedChannelId={selectedChannelId}
              selectedThreadRootMessageId={threadPanel?.root.id}
              textChannels={textChannelsWithThreads}
              threadLabelByRootMessageId={threadLabelByRootMessageId}
              visibleTextChannels={visibleTextChannels}
              visibleVoiceChannels={visibleVoiceChannels}
              voiceChannels={voiceChannels}
              voiceParticipantsByChannelId={voiceParticipantsByChannelId}
            />
            <UserProfileDropdown
              activeCall={activeCall}
              identityPictures={ownIdentityPictures}
              nodeNetworks={nodeNetworks}
              onPresenceChange={onPresenceChange}
              onPresenceStatusSelected={onPresenceStatusSelected}
              onCallEnd={onCallEnd}
              onCallParticipantScreenShareVolumeChange={
                onCallParticipantScreenShareVolumeChange
              }
              onCallParticipantVolumeChange={onCallParticipantVolumeChange}
              onCallToggleCamera={onCallToggleCamera}
              onCallToggleDeafen={onCallToggleDeafen}
              onCallToggleMute={onCallToggleMute}
              onCallToggleNoiseCancellation={onCallToggleNoiseCancellation}
              onCallToggleScreenShareAudio={onCallToggleScreenShareAudio}
              onCallToggleScreenShare={onCallToggleScreenShare}
              onLogout={onLogout}
              onSessionUpdated={onSessionUpdated}
              presence={presenceByIdentityId[session.identity.id]}
              session={session}
            />
          </div>
        </div>
      </aside>

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
              showCommunityKeyAction={!communityIsPublic}
              onClose={() => setCommunityMenuOpen(false)}
              onCommunityDataOpen={() => {
                setCommunityDataOpen(true);
                setCommunityMenuOpen(false);
              }}
              onCommunityKeyOpen={() => {
                if (communityKey) {
                  openCopyCommunityKeyDialog();
                } else {
                  setCommunityKeyError(null);
                  setCommunityKeyDialog('add');
                }

                setCommunityMenuOpen(false);
              }}
              onLeaveCommunity={() => void leaveCommunity()}
              open={communityMenuOpen}
            />
          }
          networkName={networkName}
          onCommunityMenuToggle={() =>
            setCommunityMenuOpen((isOpen) => !isOpen)
          }
          onOpenAvatar={avatarUrl ? () => setAvatarViewerOpen(true) : undefined}
          onOpenMobileSidebar={onOpenMobileSidebar}
          onPinsOpen={() => void openPinnedMessages()}
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
              setMessages((current) => mergeChatMessages(current, [message]));
              setThreadPanel(null);
              window.setTimeout(() => scrollToChannelMessage(message.id), 0);
            }}
            onSend={sendThreadMessage}
            onStickerSend={
              currentPermissions.has('send_stickers')
                ? sendThreadSticker
                : undefined
            }
            pinnedMessageIds={pinnedMessageIds}
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
              newChannelMessageCount={newChannelMessageCount}
              onAddCommunityKey={() => {
                setCommunityKeyError(null);
                setCommunityKeyDialog('add');
              }}
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
              onPollClose={closePoll}
              onPollRemoveVote={removePollVote}
              onPollVote={votePoll}
              onScroll={handleMessagesScroll}
              onStickerClick={handleStickerClick}
              currentRoleIds={currentRoleIds}
              reactionAuthorNames={reactionAuthorNames}
              polls={selectedChannelPolls}
              pinnedMessageIds={pinnedMessageIds}
              scrollerRef={scrollerRef}
              session={session}
              visibleMessages={visibleMessages}
            />
            {typingIdentityIds.length > 0 && (
              <TypingIndicator
                getIdentityName={(identityId) =>
                  memberDisplayName(memberIdentities[identityId], identityId)
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
              <StickerPackPreviewDialog
                onClose={() => setStickerPackPreview(null)}
                onStickerSend={messageComposer.handleSendChannelSticker}
                session={session}
                sticker={stickerPackPreview}
              />
            )}
            {pollDialogOpen && (
              <CreatePollDialog
                onClose={() => setPollDialogOpen(false)}
                onSubmit={handleCreatePoll}
              />
            )}
          </>
        )}
      </section>

      <CommunityMembersPanel
        community={community}
        canInvite={owner || currentPermissions.has('create_invites')}
        members={members}
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
          emptyLabel={
            messageCollection.state === 'loading'
              ? copy.app.loading
              : messageCollection.error ?? copy.messages.emptyPins
          }
          identityNames={communityIdentityNames}
          identityPictures={memberPictures}
          messages={messageCollection.messages}
          onClose={() => setMessageCollection(null)}
          onMessageOpen={(message) => {
            setMessageCollection(null);
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
        manageOpen={manageOpen}
        memberOpen={memberOpen}
        messageContextMenu={messageContextMenu}
        nodeNetworks={nodeNetworks}
        onCloseAvatarViewer={() => setAvatarViewerOpen(false)}
        onCloseBannerViewer={() => setBannerViewerOpen(false)}
        onCloseCommunityData={() => setCommunityDataOpen(false)}
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
        onEditMessage={(message) =>
          messageContextMenu?.source === 'thread'
            ? startEditingThreadMessage(message)
            : messageComposer.startEditingChannelMessage(message)
        }
        onOpenConversationWithIdentity={onOpenConversationWithIdentity}
        onOpenMessageThread={(message) => void openMessageThread(message)}
        onPinMessage={(message) => void pinMessage(message)}
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

function placeholderThreadRootMessage({
  channelId,
  communityId,
  currentIdentityId,
  rootMessageId,
}: {
  channelId: string;
  communityId: string;
  currentIdentityId: string;
  rootMessageId: string;
}): ChatMessage {
  return {
    attachments: [],
    authorIdentityId: currentIdentityId,
    content: copy.messages.originalMessage,
    encrypted: false,
    id: rootMessageId,
    mine: false,
    raw: {
      channelId,
      communityId,
      id: rootMessageId,
      type: 'sent',
    },
    reactions: [],
    timestamp: Date.now(),
  };
}

function mergeCommunityThreadMessage(
  currentThread: CommunityThreadState,
  incomingMessage: ChatMessage,
): CommunityThreadState {
  const rootMessages =
    currentThread.root.id === incomingMessage.id
      ? mergeChatMessages([currentThread.root], [incomingMessage])
      : [currentThread.root];
  const threadMessages = currentThread.messages.some(
    (message) => message.id === incomingMessage.id,
  )
    ? mergeChatMessages(currentThread.messages, [incomingMessage])
    : currentThread.messages;

  return {
    ...currentThread,
    messages: threadMessages,
    root:
      rootMessages.find((message) => message.id === currentThread.root.id) ??
      currentThread.root,
  };
}

function removeCommunityThreadMessage(
  currentThread: CommunityThreadState,
  messageId: string,
): CommunityThreadState | null {
  if (currentThread.root.id === messageId) return null;

  const deletingEditedMessage =
    currentThread.editingMessage?.message.id === messageId;

  return {
    ...currentThread,
    draft: deletingEditedMessage
      ? (currentThread.editingMessage?.previousDraft ?? '')
      : currentThread.draft,
    editingMessage: deletingEditedMessage ? null : currentThread.editingMessage,
    messages: currentThread.messages.filter((message) => message.id !== messageId),
  };
}

function threadTitleFromMessage(message: ChatMessage): string {
  if (message.content.trim()) return message.content.trim().slice(0, 64);

  if (message.sticker) return copy.stickers.stickerAlt;

  if (message.attachments.length > 0) {
    return message.attachments[0]?.filename ?? copy.messages.thread;
  }

  return shortId(message.id);
}

function findMentionTrigger(
  value: string,
): { end: number; query: string; start: number } | null {
  const match = /(^|\s)@([^\s@]*)$/.exec(value);

  if (!match || match.index === undefined) return null;

  const prefixLength = match[1]?.length ?? 0;
  const start = match.index + prefixLength;

  return {
    end: value.length,
    query: match[2] ?? '',
    start,
  };
}
