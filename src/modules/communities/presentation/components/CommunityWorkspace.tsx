import {
  EncryptedPayload,
  PrivateKey,
  PublicKey,
  StringValueObject,
} from '@haskou/value-objects';
import {
  type MouseEvent,
  type ReactNode,
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
  type CommunityMessageSearchScope,
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
  const [draft, setDraft] = useState('');
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
  const [messageSearchError, setMessageSearchError] = useState<string | null>(
    null,
  );
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState<
    CommunityMessageSearchResultItem[]
  >([]);
  const [messageSearchSearched, setMessageSearchSearched] = useState(false);
  const [messageSearchScope, setMessageSearchScope] =
    useState<CommunityMessageSearchScope>('channel');
  const [messageSearchState, setMessageSearchState] = useState<
    'idle' | 'loading'
  >('idle');
  const [profileViewer, setProfileViewer] =
    useState<CommunityProfileView | null>(null);
  const [rawMessage, setRawMessage] = useState<ChatMessage | null>(null);
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
  const owner = community.ownerIdentityId === session.identity.id;
  const network =
    nodeNetworks.find((item) => item.id === community.networkId) ?? null;
  const networkName = network?.name ?? shortId(community.networkId);
  const selectedChannel = textChannels.find(
    (channel) => channel.id === selectedChannelId,
  );
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
      textChannels.find((channel) => channel.id === channelId)?.name ??
      shortId(channelId),
    [textChannels],
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
  const runCommunityMessageSearch = useCallback(async () => {
    const query = messageSearchQuery.trim();

    if (!communityIsPublic || !query) return;

    setMessageSearchState('loading');
    setMessageSearchError(null);
    setMessageSearchSearched(true);
    try {
      const result =
        messageSearchScope === 'channel' && selectedChannelId
          ? await applicationContainer.searchCommunityChannelMessages(
              session,
              community.id,
              selectedChannelId,
              { limit: 20, query },
            )
          : await applicationContainer.searchCommunityMessages(
              session,
              community.id,
              { limit: 20, query },
            );
      const projectedResults = await Promise.all(
        result.messages.map(async (message) => {
          const channelId =
            message.channelId ?? result.channelId ?? selectedChannelId;

          if (!channelId) return null;

          return {
            channelId,
            channelName: channelNameFor(channelId),
            message: await projectChannelMessage(channelId, message),
          };
        }),
      );

      setMessageSearchResults(
        projectedResults.filter(
          (result): result is CommunityMessageSearchResultItem =>
            Boolean(result),
        ),
      );
    } catch (caught) {
      setMessageSearchError(
        toUserErrorMessage(caught, copy.communities.searchMessagesError),
      );
      setMessageSearchResults([]);
    } finally {
      setMessageSearchState('idle');
    }
  }, [
    channelNameFor,
    community.id,
    communityIsPublic,
    messageSearchQuery,
    messageSearchScope,
    projectChannelMessage,
    selectedChannelId,
    session,
  ]);
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
  const activeVoiceChannelId =
    activeCall?.kind === 'community-voice' &&
    activeCall.communityId === community.id
      ? (activeCall.channelId ?? null)
      : null;
  const visibleTextChannels = useMemo(() => {
    const query = channelSearch.trim().toLowerCase();

    if (!query) return accessibleTextChannels;

    return accessibleTextChannels.filter((channel) =>
      channel.name.toLowerCase().includes(query),
    );
  }, [accessibleTextChannels, channelSearch]);
  const visibleVoiceChannels = useMemo(() => {
    const query = channelSearch.trim().toLowerCase();

    if (!query) return accessibleVoiceChannels;

    return accessibleVoiceChannels.filter((channel) =>
      channel.name.toLowerCase().includes(query),
    );
  }, [accessibleVoiceChannels, channelSearch]);
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
    session,
    visibleVoiceChannels,
    voiceChannels,
  });
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

      setDraft(
        `${draft.slice(0, trigger.start)}${token} ${draft.slice(trigger.end)}`,
      );
    },
    [draft],
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
    },
    [],
  );

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
    setDraft,
    setMessages,
  });

  useEffect(() => {
    messageComposer.resetForChannelChange();
  }, [selectedChannelId]);

  useCommunityChannelRealtime({
    communityId: community.id,
    incrementNewChannelMessageCount,
    isScrolledNearBottom,
    loadChannelMessages,
    onChannelViewed,
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
          'app-safe-area-drawer-until-lg app-safe-area-drawer-flush fixed inset-y-0 left-0 z-40 w-full max-w-[430px] p-0 transition sm:w-[calc(86vw+82px)] sm:max-w-[442px] lg:static lg:z-auto lg:block lg:w-auto lg:max-w-none',
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
              onTextChannelSelected={handleChannelSelected}
              onVoiceChannelJoin={joinVoiceChannel}
              onVoiceParticipantClick={openVoiceParticipantProfile}
              selectedChannelId={selectedChannelId}
              textChannels={textChannels}
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
          onRealtimeEventsOpen={onRealtimeEventsOpen}
          realtimeStatus={realtimeStatus}
          selectedChannel={selectedChannel}
        >
          {communityIsPublic ? (
            <button
              className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-black text-white/70 transition hover:bg-white/15"
              onClick={() => setMessageSearchOpen((open) => !open)}
              type="button"
            >
              {copy.communities.searchMessages}
            </button>
          ) : null}
        </CommunityHeader>

        {communityIsPublic && messageSearchOpen ? (
          <CommunityMessageSearchPanel
            disabled={!selectedChannel && messageSearchScope === 'channel'}
            error={messageSearchError}
            onClose={() => setMessageSearchOpen(false)}
            onQueryChange={(query) => {
              setMessageSearchQuery(query);
              setMessageSearchSearched(false);
            }}
            onResultClick={handleSearchResultClick}
            onScopeChange={(scope) => {
              setMessageSearchScope(scope);
              setMessageSearchSearched(false);
            }}
            onSubmit={() => void runCommunityMessageSearch()}
            query={messageSearchQuery}
            results={messageSearchResults}
            searched={messageSearchSearched}
            scope={messageSearchScope}
            state={messageSearchState}
          />
        ) : null}

        {!selectedChannel ? (
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
          void messageComposer.handleDeleteChannelMessage(message)
        }
        onEditMessage={messageComposer.startEditingChannelMessage}
        onOpenConversationWithIdentity={onOpenConversationWithIdentity}
        onReplyToMessage={(message) => {
          messageComposer.startReplyToMessage(message);
          setMessageContextMenu(null);
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
        owner={owner}
        presenceByIdentityId={presenceByIdentityId}
        profileViewer={profileViewer}
        rawMessage={rawMessage}
        session={session}
      />
    </>
  );
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
