import {
  EncryptedPayload,
  PrivateKey,
  PublicKey,
  StringValueObject,
  UUID,
} from '@haskou/value-objects';
import {
  Fragment,
  type MouseEvent,
  type ReactNode,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type {
  CallParticipant,
  CallSession,
} from '../../domain/calls/CallSession';
import type {
  Community,
  CommunityChannel,
  CommunityTextChannel,
  CommunityVoiceChannel,
  ConversationKeyEntry,
  AttachmentProgress,
  ChatMessage,
  IdentityPresence,
  IdentityResource,
  MessageAttachment,
  MessageReplyPreview,
  MessageResource,
  SelectablePresenceStatus,
  Session,
} from '../../domain/types';
import type { RealtimeDomainEvent } from '../../infrastructure/realtime/RealtimeGateway';

import { pigeonApplication } from '../../application/applicationContainer';
import { pendingFileAttachments } from '../../domain/attachments/pendingFileAttachments';
import {
  decryptCommunityChannelPayload,
  encryptCommunityChannelPayload,
} from '../../domain/communities/communityChannelPayloadCipher';
import {
  communityTextChannels,
  communityVoiceChannels,
} from '../../domain/communities/communityChannels';
import { updateMessageReaction } from '../../domain/messages/updateMessageReaction';
import { copy } from '../../i18n/en';
import { isBrowserPreviewImage } from '../../utils/browserPreview';
import { cx } from '../../utils/classNameHelper';
import {
  formatDateSeparator,
  isSameDay,
  shortId,
} from '../../utils/formatting';
import { identityName } from '../../utils/identityDisplay';
import { normalizeIdentityId } from '../../utils/identityId';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { HeadphonesIcon, MicrophoneIcon } from '../calls/CallIcons';
import { Composer } from '../chat/Composer';
import { DateSeparator } from '../chat/DateSeparator';
import { ImageLightbox } from '../chat/ImageLightbox';
import { MessageBubble } from '../chat/MessageBubble';
import { MessageListSkeleton } from '../chat/MessageListSkeleton';
import { UserProfileDialog } from '../profile/UserProfileDialog';
import { ConversationDataDialog } from '../workspace/ConversationDataDialog';
import { ConversationKeyDialog } from '../workspace/ConversationKeyDialog';
import { LockIcon } from '../workspace/LockIcon';
import {
  MessageContextMenu,
  type MessageContextMenuState,
} from '../workspace/MessageContextMenu';
import { RawMessageDialog } from '../workspace/RawMessageDialog';
import { UserProfileDropdown } from '../workspace/Sidebar';
import { AddCommunityMemberDialog } from './AddCommunityMemberDialog';
import { VoiceIcon } from './communityDialogPrimitives';
import { loadIdentityPicture, loadPublicImage } from './communityImages';
import { MemberRow } from './MemberRow';
import { memberDisplayName } from './communityMemberNames';
import { ManageCommunityDialog } from './ManageCommunityDialog';

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
  onCallToggleCamera?: () => void;
  onCallToggleDeafen?: () => void;
  onCallToggleMute?: () => void;
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

type MemberView = {
  anchor?: ProfilePopoverAnchor;
  identity?: IdentityResource;
  identityId: string;
  pictureUrl: null | string;
};

type ProfilePopoverAnchor = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type CommunityPendingSend = {
  attachments: File[];
  channelId: string;
  content: string;
  replyTarget: ChatMessage | null;
};

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

function profileAnchorFromTarget(
  target: HTMLElement | null | undefined,
): ProfilePopoverAnchor | undefined {
  if (!target) return undefined;

  const rect = target.getBoundingClientRect();

  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
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
  presenceByIdentityId = {},
  onCallEnd,
  onCallParticipantVolumeChange,
  onCallToggleCamera,
  onCallToggleDeafen,
  onCallToggleMute,
  onCallToggleScreenShare,
  onChannelSelected,
  onChannelViewed,
  onCommunityLeft,
  onCommunityUpdated,
  onJoinVoiceChannel,
  onLogout,
  onPresenceChange,
  onPresenceStatusSelected,
  onMobileMembersClose,
  onMobileSidebarClose,
  onOpenConversationWithIdentity,
  onOpenMobileSidebar,
  onRealtimeEventsOpen,
  onSessionUpdated,
  onTypingActive,
  realtimeEvent,
  realtimeStatus = 'connected',
  session,
  typingIdentityIds = [],
}: CommunityWorkspaceProps) {
  const textChannels = useMemo(
    () => communityTextChannels(community),
    [community],
  );
  const voiceChannels = useMemo(
    () => communityVoiceChannels(community),
    [community],
  );
  const resolvedChannelId = useMemo(
    () => resolveCommunityChannelId(activeChannelId, textChannels),
    [activeChannelId, textChannels],
  );
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    resolvedChannelId,
  );
  const [newChannelMessageCount, setNewChannelMessageCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<null | string>(null);
  const [messageState, setMessageState] = useState<
    'error' | 'idle' | 'loading'
  >('idle');
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentProgress] = useState<AttachmentProgress | null>(null);
  const [memberIdentities, setMemberIdentities] = useState<
    Record<string, IdentityResource>
  >({});
  const [memberPictures, setMemberPictures] = useState<Record<string, string>>(
    {},
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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
  const [profileViewer, setProfileViewer] = useState<MemberView | null>(null);
  const [rawMessage, setRawMessage] = useState<ChatMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [failedSends, setFailedSends] = useState<
    Record<string, CommunityPendingSend>
  >({});
  const [isAwayFromBottom, setIsAwayFromBottom] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const keepChannelBottomUntilRef = useRef(0);
  const messageStateRef = useRef<'error' | 'idle' | 'loading'>('idle');
  const memberIdentitiesRef = useRef<Record<string, IdentityResource>>({});
  const onCommunityUpdatedRef = useRef(onCommunityUpdated);
  const sendQueueRef = useRef(Promise.resolve());
  const onChannelSelectedRef = useRef(onChannelSelected);
  const onChannelViewedRef = useRef(onChannelViewed);
  const owner = community.ownerIdentityId === session.identity.id;
  const network =
    nodeNetworks.find((item) => item.id === community.networkId) ?? null;
  const networkName = network?.name ?? shortId(community.networkId);
  const selectedChannel = textChannels.find(
    (channel) => channel.id === selectedChannelId,
  );
  const communityKey = session.keychain.conversations[community.id];
  const activeVoiceChannelId =
    activeCall?.kind === 'community-voice' &&
    activeCall.communityId === community.id
      ? activeCall.channelId
      : null;
  const channelEncryptionReady =
    !!selectedChannel &&
    !!communityKey &&
    community.memberIds.every(
      (identityId) =>
        identityId === session.identity.id || memberIdentities[identityId],
    );

  const setMessageLoadState = useCallback(
    (state: 'error' | 'idle' | 'loading') => {
      messageStateRef.current = state;
      setMessageState(state);
    },
    [],
  );

  useEffect(() => {
    memberIdentitiesRef.current = memberIdentities;
  }, [memberIdentities]);

  useEffect(() => {
    onCommunityUpdatedRef.current = onCommunityUpdated;
    onChannelSelectedRef.current = onChannelSelected;
    onChannelViewedRef.current = onChannelViewed;
  }, [onChannelSelected, onChannelViewed, onCommunityUpdated]);
  const channelEncryptionTooltip = channelEncryptionReady
    ? copy.chat.e2eReady
    : copy.chat.e2eMissing;
  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) => message.deliveryStatus || message.raw.type !== 'deleted',
      ),
    [messages],
  );
  const missingCommunityKey =
    !communityKey &&
    (!owner ||
      (visibleMessages.length > 0 &&
        visibleMessages.every((message) => message.encrypted)));

  const members = useMemo<MemberView[]>(
    () =>
      community.memberIds.map((identityId) => ({
        identity: memberIdentities[identityId],
        identityId,
        pictureUrl: memberPictures[identityId] ?? null,
      })),
    [community.memberIds, memberIdentities, memberPictures],
  );
  const communityMemberIdsKey = useMemo(
    () => community.memberIds.join('\u0000'),
    [community.memberIds],
  );
  const communityMemberIds = useMemo(
    () =>
      communityMemberIdsKey.length > 0
        ? communityMemberIdsKey.split('\u0000')
        : [],
    [communityMemberIdsKey],
  );
  const voiceConnectedIdentityIds = useMemo(
    () =>
      voiceChannels.flatMap((channel) => channel.connectedIdentityIds ?? []),
    [voiceChannels],
  );
  const identityIdsToLoad = useMemo(
    () =>
      Array.from(
        new Set([...communityMemberIds, ...voiceConnectedIdentityIds]),
      ),
    [communityMemberIds, voiceConnectedIdentityIds],
  );
  const openMemberProfile = (
    member: MemberView,
    anchor?: ProfilePopoverAnchor,
  ) => setProfileViewer({ ...member, anchor });
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
      const published = await pigeonApplication.publishKeychain(session, {
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
      const updatedCommunity = await pigeonApplication.leaveCommunity(
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
  const visibleTextChannels = useMemo(() => {
    const query = channelSearch.trim().toLowerCase();

    if (!query) return textChannels;

    return textChannels.filter((channel) =>
      channel.name.toLowerCase().includes(query),
    );
  }, [channelSearch, textChannels]);
  const visibleVoiceChannels = useMemo(() => {
    const query = channelSearch.trim().toLowerCase();

    if (!query) return voiceChannels;

    return voiceChannels.filter((channel) =>
      channel.name.toLowerCase().includes(query),
    );
  }, [channelSearch, voiceChannels]);
  const isScrolledNearBottom = useCallback(() => {
    const scroller = scrollerRef.current;

    if (!scroller) return true;

    return (
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140
    );
  }, []);
  const scrollChannelToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto', keepPinned = false) => {
      const scroll = () => bottomRef.current?.scrollIntoView({ behavior });

      if (keepPinned) {
        keepChannelBottomUntilRef.current = Date.now() + 5000;
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
  const handleChannelSelected = useCallback(
    (channelId: string) => {
      setSelectedChannelId(channelId);
      setNewChannelMessageCount(0);
      onChannelViewed?.(channelId);
      onChannelSelected(channelId);
      onMobileSidebarClose();
    },
    [onChannelSelected, onChannelViewed, onMobileSidebarClose],
  );
  const ownIdentityPictures = useMemo(
    () =>
      memberPictures[session.identity.id]
        ? { [session.identity.id]: memberPictures[session.identity.id] }
        : {},
    [memberPictures, session.identity.id],
  );
  const reactionAuthorNames = useMemo(
    () =>
      Object.fromEntries(
        community.memberIds.map((identityId) => [
          identityId,
          memberDisplayName(memberIdentities[identityId], identityId),
        ]),
      ),
    [community.memberIds, memberIdentities],
  );
  const callParticipantForIdentity = useCallback(
    (identityId: string): CallParticipant => {
      const identity =
        identityId === session.identity.id
          ? session.identity
          : memberIdentities[identityId];

      return {
        identity,
        identityId,
        deafened: false,
        muted: false,
        name: identity
          ? (identityName(identity) ?? shortId(identityId))
          : shortId(identityId),
        picture: memberPictures[identityId] ?? null,
      };
    },
    [memberIdentities, memberPictures, session.identity],
  );
  const voiceParticipantsForChannel = useCallback(
    (channel: CommunityChannel): CallParticipant[] => {
      if (channel.type !== 'voice') return [];

      const activeParticipants =
        activeVoiceChannelId === channel.id
          ? (activeCall?.participants ?? [])
          : [];
      const activeByIdentityId = new Map(
        activeParticipants.map((participant) => [
          participant.identityId,
          participant,
        ]),
      );
      const identityIds = Array.from(
        new Set([
          ...(channel.connectedIdentityIds ?? []),
          ...activeParticipants.map((participant) => participant.identityId),
        ]),
      );

      return identityIds.map(
        (identityId) =>
          activeByIdentityId.get(identityId) ??
          callParticipantForIdentity(identityId),
      );
    },
    [
      activeCall?.participants,
      activeVoiceChannelId,
      callParticipantForIdentity,
    ],
  );
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
      textChannels.find((channel) => channel.id === activeChannelId)?.id ??
      textChannels.find((channel) => channel.id === selectedChannelId)?.id ??
      textChannels[0]?.id ??
      null;

    setSelectedChannelId(nextSelectedChannel);

    if (nextSelectedChannel) onChannelSelected(nextSelectedChannel);
  }, [activeChannelId, onChannelSelected, selectedChannelId, textChannels]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      identityIdsToLoad.map(async (identityId) => {
        try {
          const identity =
            identityId === session.identity.id
              ? session.identity
              : await pigeonApplication.getIdentity(
                  normalizeIdentityId(identityId),
                );
          const pictureUrl = await loadIdentityPicture(identity);

          return [identityId, identity, pictureUrl] as const;
        } catch {
          return [identityId, undefined, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;

      const nextIdentities: Record<string, IdentityResource> = {};
      const nextPictures: Record<string, string> = {};

      for (const [identityId, identity, pictureUrl] of entries) {
        if (identity) nextIdentities[identityId] = identity;

        if (pictureUrl) nextPictures[identityId] = pictureUrl;
      }

      setMemberIdentities(nextIdentities);
      setMemberPictures(nextPictures);
    });

    return () => {
      cancelled = true;
    };
  }, [identityIdsToLoad, session.identity]);

  useEffect(() => {
    let cancelled = false;

    void pigeonApplication
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
            await pigeonApplication.getIdentity(
              normalizeIdentityId(identityId),
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

  const projectChannelMessage = useCallback(
    async (
      rawMessage: MessageResource,
      identities: Record<string, IdentityResource>,
    ): Promise<ChatMessage> => {
      const authorIdentityId =
        rawMessage.authorIdentityId ??
        rawMessage.actorIdentityId ??
        session.identity.id;
      const base = {
        attachments: [],
        authorIdentityId,
        id: rawMessage.id ?? `${rawMessage.createdAt ?? Date.now()}`,
        mine: authorIdentityId === session.identity.id,
        raw: rawMessage,
        reactions: rawMessage.reactions ?? [],
        timestamp: rawMessage.createdAt ?? Date.now(),
      };

      if (rawMessage.type === 'call_event') {
        return {
          ...base,
          content: '',
          encrypted: false,
          kind: 'call-event',
        };
      }

      try {
        const payload = await decryptCommunityChannelPayload(
          session,
          rawMessage.encryptedPayload ?? '',
          copy.messages.missingKey,
          community.id,
        );

        return {
          ...base,
          attachments: payload.attachments ?? [],
          authorIdentityId: payload.authorIdentityId ?? base.authorIdentityId,
          content: payload.content ?? '',
          encrypted: false,
          mine:
            (payload.authorIdentityId ?? base.authorIdentityId) ===
            session.identity.id,
          replyPreview: payload.reply,
          replyToMessageId: payload.replyToMessageId,
          timestamp: payload.timestamp ?? base.timestamp,
        };
      } catch {
        return {
          ...base,
          authorIdentityId:
            rawMessage.authorIdentityId ??
            identities[rawMessage.authorIdentityId ?? '']?.id ??
            'unknown',
          content: copy.messages.decryptFailed,
          encrypted: true,
        };
      }
    },
    [session],
  );

  const loadChannelMessages = useCallback(
    async (channelId: string, beforeMessageId?: string) => {
      const [identities, result] = await Promise.all([
        resolveMemberIdentities(),
        pigeonApplication.listCommunityChannelMessages(
          session,
          community.id,
          channelId,
          { beforeMessageId },
        ),
      ]);
      const loadedMessages = await Promise.all(
        result.messages.map((message) =>
          projectChannelMessage(message, identities),
        ),
      );

      return {
        cursor: result.nextBeforeMessageId ?? null,
        loadedMessages,
      };
    },
    [community.id, projectChannelMessage, resolveMemberIdentities, session],
  );
  const loadChannelMessagesRef = useRef(loadChannelMessages);

  useEffect(() => {
    loadChannelMessagesRef.current = loadChannelMessages;
  }, [loadChannelMessages]);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) return undefined;

    const handleMediaLayoutChange = () => {
      if (Date.now() > keepChannelBottomUntilRef.current) return;

      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: 'end' });
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

  const handleMessagesScroll = () => {
    const scroller = scrollerRef.current;
    const nearBottom = isScrolledNearBottom();

    setIsAwayFromBottom(!nearBottom);

    if (nearBottom) {
      setNewChannelMessageCount(0);

      if (selectedChannelId) onChannelViewed?.(selectedChannelId);
    }

    if (!scroller || scroller.scrollTop > 80 || !messageCursor) return;

    if (messageStateRef.current === 'loading' || !selectedChannelId) return;

    const previousHeight = scroller.scrollHeight;

    setMessageLoadState('loading');
    void loadChannelMessages(selectedChannelId, messageCursor)
      .then(({ cursor, loadedMessages }) => {
        setMessages((current) => [...loadedMessages, ...current]);
        setMessageCursor(cursor);
        requestAnimationFrame(() => {
          if (!scrollerRef.current) return;
          scrollerRef.current.scrollTop =
            scrollerRef.current.scrollHeight - previousHeight;
        });
      })
      .catch(() => setMessageLoadState('error'))
      .finally(() => setMessageLoadState('idle'));
  };

  const handleSendChannelMessage = (
    content: string,
    attachments: File[],
  ): Promise<void> => {
    if (!selectedChannelId) return Promise.resolve();

    onTypingActive?.(selectedChannelId, false);
    sendPendingChannelMessage({
      attachments,
      channelId: selectedChannelId,
      content,
      replyTarget,
    });
    setReplyTarget(null);

    return Promise.resolve();
  };
  const handleDraftChange = (value: string) => {
    setDraft(value);

    if (selectedChannelId) {
      onTypingActive?.(selectedChannelId, value.trim().length > 0);
    }
  };

  useEffect(
    () => () => {
      if (selectedChannelId) onTypingActive?.(selectedChannelId, false);
    },
    [onTypingActive, selectedChannelId],
  );

  const sendPendingChannelMessage = (payload: CommunityPendingSend) => {
    setSendError(null);
    const timestamp = Date.now();
    const optimisticId = `pending:${community.id}:${payload.channelId}:${timestamp}:${UUID.generate().toString()}`;

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
        raw: {
          channelId: payload.channelId,
          communityId: community.id,
          id: optimisticId,
          type: 'sent',
        },
        reactions: [],
        replyPreview: replyPreviewFromMessage(payload.replyTarget),
        replyToMessageId: payload.replyTarget?.id,
        timestamp,
      },
    ]);
    scrollChannelToBottom('smooth');

    sendQueueRef.current = sendQueueRef.current.then(async () => {
      try {
        const identities = await resolveMemberIdentities();
        const messageAttachments =
          await pigeonApplication.publishMessageAttachments(
            session,
            payload.attachments,
            (progress) => {
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
          );
        const encryptedPayload = await encryptCommunityChannelPayload({
          attachments: messageAttachments,
          authorIdentityId: session.identity.id,
          channelId: payload.channelId,
          communityId: community.id,
          communityKey: session.keychain.conversations[community.id],
          content: payload.content,
          recipients: Object.values(identities),
          replyPreview: replyPreviewFromMessage(payload.replyTarget),
          replyToMessageId: payload.replyTarget?.id,
          timestamp,
        });
        const created = await pigeonApplication.createCommunityChannelMessage(
          session,
          community.id,
          payload.channelId,
          {
            attachmentExternalIdentifiers: messageAttachments.map(
              (attachment) => attachment.cid,
            ),
            encryptedPayload,
            timestamp,
          },
        );
        const projected = await projectChannelMessage(created, identities);

        setMessages((current) =>
          mergeChatMessages(
            current.filter((message) => message.id !== optimisticId),
            [projected],
          ),
        );
        scrollChannelToBottom('smooth', true);
      } catch (caught) {
        setSendError(toUserErrorMessage(caught, copy.communities.messageError));
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

  const retryChannelMessage = (message: ChatMessage) => {
    const pending = failedSends[message.id];

    if (!pending) return;

    setMessages((current) => current.filter((item) => item.id !== message.id));
    void sendPendingChannelMessage(pending);
  };

  const scrollToChannelMessage = (messageId: string) => {
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

  const handleReplyReferenceClick = (messageId: string) => {
    if (messages.some((message) => message.id === messageId)) {
      scrollToChannelMessage(messageId);

      return;
    }

    setSendError(copy.messages.replyTargetNotFound);
  };

  const handleDeleteChannelMessage = async (message: ChatMessage) => {
    if (!selectedChannelId || !message.mine) return;

    if (!window.confirm(copy.messages.deleteConfirm)) return;

    setMessageContextMenu(null);
    setSendError(null);
    try {
      await pigeonApplication.deleteCommunityChannelMessage(
        session,
        community.id,
        selectedChannelId,
        message.id,
      );
      setMessages((current) =>
        current.filter((item) => item.id !== message.id),
      );
    } catch (caught) {
      setSendError(toUserErrorMessage(caught, copy.messages.deleteError));
    }
  };

  const handleToggleChannelMessageReaction = async (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => {
    if (!selectedChannelId) return;

    const channelId = selectedChannelId;

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
        await pigeonApplication.removeCommunityChannelMessageReaction(
          session,
          community.id,
          channelId,
          message.id,
          emoji,
        );
      } else {
        await pigeonApplication.addCommunityChannelMessageReaction(
          session,
          community.id,
          channelId,
          message.id,
          emoji,
        );
      }
    } catch (caught) {
      setSendError(toUserErrorMessage(caught, copy.messages.reactionError));
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? updateMessageReaction(
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

  const loadAttachmentPreview = useCallback(
    async (
      attachment: MessageAttachment,
      onProgress?: (progress: AttachmentProgress) => void,
    ): Promise<string> => {
      const blob = await pigeonApplication.downloadAttachment(
        attachment,
        onProgress,
      );

      return URL.createObjectURL(blob);
    },
    [],
  );

  const openAttachment = async (attachment?: MessageAttachment) => {
    if (!attachment) return;

    try {
      const url = await loadAttachmentPreview(attachment);
      const link = document.createElement('a');

      link.href = url;
      link.download = attachment.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setSendError(copy.composer.attachmentDownloadError);
    }
  };

  useEffect(() => {
    setSelectedChannelId(resolvedChannelId);
    setReplyTarget(null);
    setNewChannelMessageCount(0);

    if (resolvedChannelId) {
      onChannelViewedRef.current?.(resolvedChannelId);
      onChannelSelectedRef.current(resolvedChannelId);
    }
  }, [resolvedChannelId]);

  useEffect(() => {
    if (!selectedChannelId) {
      setMessages([]);
      setMessageCursor(null);
      setMessageLoadState('idle');

      return undefined;
    }

    let cancelled = false;

    setMessages([]);
    setMessageCursor(null);
    setReplyTarget(null);
    setNewChannelMessageCount(0);
    setMessageLoadState('loading');
    setSendError(null);
    void loadChannelMessagesRef
      .current(selectedChannelId)
      .then(({ cursor, loadedMessages }) => {
        if (cancelled) return;
        setMessages(loadedMessages);
        setMessageCursor(cursor);
        setNewChannelMessageCount(0);
        onChannelViewedRef.current?.(selectedChannelId);
        scrollChannelToBottom('auto', true);
      })
      .catch(() => {
        if (!cancelled) setMessageLoadState('error');
      })
      .finally(() => {
        if (!cancelled) setMessageLoadState('idle');
      });

    return () => {
      cancelled = true;
    };
  }, [scrollChannelToBottom, selectedChannelId, setMessageLoadState]);

  useEffect(() => {
    if (!realtimeEvent || realtimeEvent.aggregate_id !== community.id) return;

    const channelId = realtimeStringAttribute(realtimeEvent, 'channelId');

    if (!channelId || channelId !== selectedChannelId) return;

    if (realtimeEvent.type === 'communities.v1.channel.message.was_deleted') {
      const targetMessageId = realtimeStringAttribute(
        realtimeEvent,
        'targetMessageId',
      );

      if (!targetMessageId) return;

      setMessages((current) =>
        current.filter((message) => message.id !== targetMessageId),
      );

      return;
    }

    if (
      realtimeEvent.type ===
        'communities.v1.channel.message.reaction.was_added' ||
      realtimeEvent.type ===
        'communities.v1.channel.message.reaction.was_removed'
    ) {
      const messageId = realtimeStringAttribute(realtimeEvent, 'messageId');
      const authorIdentityId = realtimeStringAttribute(
        realtimeEvent,
        'authorId',
        'authorIdentityId',
      );
      const emoji = realtimeStringAttribute(realtimeEvent, 'emoji');

      if (!messageId || !authorIdentityId || !emoji) return;

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? updateMessageReaction(
                message,
                authorIdentityId,
                emoji,
                realtimeEvent.type.endsWith('.was_added') ? 'add' : 'remove',
                typeof realtimeEvent.attributes.createdAt === 'number'
                  ? realtimeEvent.attributes.createdAt
                  : realtimeEvent.occurred_on,
              )
            : message,
        ),
      );

      return;
    }

    if (
      realtimeEvent.type !== 'communities.v1.channel.message.was_sent' &&
      realtimeEvent.type !== 'communities.v1.call.event.was_recorded'
    ) {
      return;
    }

    const message = realtimeMessageAttribute(realtimeEvent);

    if (!message) return;

    const shouldStickToBottom = isScrolledNearBottom();
    let cancelled = false;

    void resolveMemberIdentities()
      .then((identities) => projectChannelMessage(message, identities))
      .then((projected) => {
        if (cancelled) return;

        setMessages((current) => {
          if (current.some((item) => item.id === projected.id)) return current;

          return [...current, projected].sort(
            (left, right) => left.timestamp - right.timestamp,
          );
        });

        if (shouldStickToBottom) {
          setNewChannelMessageCount(0);
          onChannelViewed?.(channelId);
          scrollChannelToBottom('smooth', true);
        } else {
          setNewChannelMessageCount((current) => current + 1);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    community.id,
    isScrolledNearBottom,
    onChannelViewed,
    projectChannelMessage,
    realtimeEvent,
    resolveMemberIdentities,
    selectedChannelId,
    session.identity.id,
    scrollChannelToBottom,
  ]);

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
          'fixed inset-y-0 left-0 z-40 w-[calc(100vw-1.5rem)] max-w-[442px] p-3 transition sm:w-[calc(86vw+82px)] lg:static lg:z-auto lg:block lg:w-auto lg:max-w-none lg:p-0',
          mobileSidebarOpen ? 'block' : 'hidden lg:block',
        )}
      >
        <div className="grid h-full grid-cols-[82px_minmax(0,1fr)] gap-0 lg:block">
          <div className="lg:hidden">{mobileRail}</div>
          <div className="glass-panel-strong flex h-full min-h-0 flex-col rounded-none p-4">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {copy.communities.privateCommunity}
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
                  {owner && (
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

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {copy.communities.channels}
              </div>
              <input
                value={channelSearch}
                onChange={(event) => setChannelSearch(event.target.value)}
                className="mb-3 w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                placeholder={copy.communities.searchChannels}
              />
              <div className="space-y-2">
                {textChannels.length === 0 && voiceChannels.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
                    {copy.communities.noChannels}
                  </div>
                ) : visibleTextChannels.length === 0 &&
                  visibleVoiceChannels.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
                    {copy.communities.noMatchingChannels}
                  </div>
                ) : (
                  <>
                    {visibleTextChannels.map((channel) => (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => handleChannelSelected(channel.id)}
                        className={cx(
                          'flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm font-black transition',
                          selectedChannelId === channel.id
                            ? 'bg-white text-slate-950'
                            : 'bg-white/8 text-white hover:bg-white/14',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          # {channel.name}
                        </span>
                        {(channelUnreadCounts[channel.id] ?? 0) > 0 && (
                          <span className="grid min-w-5 place-items-center rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[0.65rem] leading-none text-white">
                            {(channelUnreadCounts[channel.id] ?? 0) > 9
                              ? '9+'
                              : channelUnreadCounts[channel.id]}
                          </span>
                        )}
                      </button>
                    ))}
                    {visibleVoiceChannels.length > 0 && (
                      <div className="pt-3">
                        <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
                          {copy.calls.voiceChannels}
                        </div>
                        <div className="space-y-2">
                          {visibleVoiceChannels.map((channel) => (
                            <VoiceChannelButton
                              key={channel.id}
                              active={activeVoiceChannelId === channel.id}
                              channel={channel}
                              onJoin={() => onJoinVoiceChannel?.(channel)}
                              onParticipantClick={(participant, event) =>
                                openMemberProfile(
                                  {
                                    identity:
                                      participant.identityId ===
                                      session.identity.id
                                        ? session.identity
                                        : memberIdentities[
                                            participant.identityId
                                          ],
                                    identityId: participant.identityId,
                                    pictureUrl: participant.picture ?? null,
                                  },
                                  profileAnchorFromTarget(event.currentTarget),
                                )
                              }
                              participants={voiceParticipantsForChannel(
                                channel,
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <UserProfileDropdown
              activeCall={activeCall}
              identityPictures={ownIdentityPictures}
              nodeNetworks={nodeNetworks}
              onPresenceChange={onPresenceChange}
              onPresenceStatusSelected={onPresenceStatusSelected}
              onCallEnd={onCallEnd}
              onCallParticipantVolumeChange={onCallParticipantVolumeChange}
              onCallToggleCamera={onCallToggleCamera}
              onCallToggleDeafen={onCallToggleDeafen}
              onCallToggleMute={onCallToggleMute}
              onCallToggleScreenShare={onCallToggleScreenShare}
              onLogout={onLogout}
              onSessionUpdated={onSessionUpdated}
              presence={presenceByIdentityId[session.identity.id]}
              session={session}
            />
          </div>
        </div>
      </aside>

      <section className="glass-panel-strong flex min-h-0 flex-col overflow-hidden rounded-none">
        <header className="border-b border-white/10 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-white lg:hidden"
              aria-label={copy.chat.menu}
            >
              ☰
            </button>
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                community.name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-2xl font-black">
                  {selectedChannel
                    ? `# ${selectedChannel.name}`
                    : community.name}
                </h1>
                <span
                  className={
                    channelEncryptionReady
                      ? 'shrink-0 text-emerald-300'
                      : 'shrink-0 text-rose-300'
                  }
                  title={channelEncryptionTooltip}
                  aria-label={channelEncryptionTooltip}
                >
                  <LockIcon locked={channelEncryptionReady} />
                </span>
              </div>
              {selectedChannel ? (
                <p className="truncate text-sm text-white/50">
                  {copy.communities.channelMetadataOnly}{' '}
                  <span title={community.networkId}>{networkName}</span>
                </p>
              ) : (
                <p className="truncate text-sm text-white/50">
                  {community.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onRealtimeEventsOpen}
              className={cx(
                'hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black transition sm:flex',
                realtimeStatus === 'connected'
                  ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15'
                  : 'border-amber-300/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15',
              )}
              title={
                realtimeStatus === 'connected'
                  ? copy.chat.realtimeConnected
                  : copy.chat.realtimeReconnecting
              }
            >
              <span
                className={cx(
                  'h-2 w-2 rounded-full',
                  realtimeStatus === 'connected'
                    ? 'bg-emerald-300'
                    : 'bg-amber-300',
                )}
              />
              {realtimeStatus === 'connected'
                ? copy.chat.realtimeConnected
                : copy.chat.realtimeReconnecting}
            </button>
            <div className="relative ml-auto shrink-0">
              {communityLeaveError ? (
                <div className="absolute bottom-[calc(100%+.5rem)] right-0 z-40 w-72 rounded-2xl border border-rose-300/20 bg-rose-500/15 p-3 text-xs font-black text-rose-100 shadow-2xl shadow-black/40">
                  {communityLeaveError}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setCommunityMenuOpen((isOpen) => !isOpen)}
                className="grid h-11 w-11 place-items-center rounded-2xl text-xl font-black text-white/70 transition hover:bg-white/15"
                aria-label={copy.chat.conversationMenu}
                aria-expanded={communityMenuOpen}
              >
                ⋮
              </button>
              {communityMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-30 cursor-default"
                    onClick={() => setCommunityMenuOpen(false)}
                    aria-label={copy.dialog.close}
                  />
                  <div className="absolute right-0 top-[calc(100%+.5rem)] z-40 min-w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#15172d] p-1 text-sm shadow-2xl shadow-black/40">
                    <button
                      type="button"
                      onClick={() => {
                        setCommunityDataOpen(true);
                        setCommunityMenuOpen(false);
                      }}
                      className="block w-full rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
                    >
                      {copy.chat.viewData}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (communityKey) {
                          openCopyCommunityKeyDialog();
                        } else {
                          setCommunityKeyError(null);
                          setCommunityKeyDialog('add');
                        }

                        setCommunityMenuOpen(false);
                      }}
                      className="block w-full rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
                    >
                      {communityKey
                        ? copy.chat.copyPrivateKey
                        : copy.chat.addPrivateKey}
                    </button>
                    <button
                      type="button"
                      onClick={() => void leaveCommunity()}
                      disabled={communityLeaving}
                      className="block w-full rounded-2xl px-3 py-2 text-left font-black text-rose-100 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:text-white/30 disabled:hover:bg-transparent"
                    >
                      {communityLeaving
                        ? copy.communities.leaving
                        : copy.communities.leave}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

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
            <div className="relative min-h-0 flex-1">
              <div
                ref={scrollerRef}
                onScroll={handleMessagesScroll}
                className="h-full overflow-y-auto p-4 sm:p-6"
              >
                {messageState === 'loading' && visibleMessages.length === 0 ? (
                  <MessageListSkeleton />
                ) : messageState === 'loading' ? (
                  <div className="mx-auto mb-4 w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/60">
                    {copy.chat.loadingEvents}
                  </div>
                ) : null}
                <div>
                  {!messageCursor &&
                    visibleMessages.length > 0 &&
                    messageState !== 'loading' && (
                      <div className="mx-auto w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/35">
                        {copy.chat.noMoreMessages}
                      </div>
                    )}
                  {missingCommunityKey && (
                    <div className="grid min-h-[28vh] place-items-center">
                      <div className="w-full max-w-md rounded-2xl border border-rose-300/20 bg-rose-500/10 p-5 text-center text-sm text-rose-100">
                        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/15">
                          <LockIcon locked={false} />
                        </div>
                        <div className="font-black">{copy.chat.e2eMissing}</div>
                        <div className="mt-2 text-rose-100/65">
                          {copy.messages.missingCommunityKey}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCommunityKeyError(null);
                            setCommunityKeyDialog('add');
                          }}
                          className="mt-4 rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-100"
                        >
                          {copy.chat.addPrivateKey}
                        </button>
                      </div>
                    </div>
                  )}
                  {!missingCommunityKey &&
                    visibleMessages.map((message, index) => {
                      const previousMessage = visibleMessages[index - 1];
                      const nextMessage = visibleMessages[index + 1];
                      const replyMessage = message.replyToMessageId
                        ? visibleMessages.find(
                            (item) => item.id === message.replyToMessageId,
                          )
                        : undefined;
                      const startsNewDay =
                        !previousMessage ||
                        !isSameDay(
                          previousMessage.timestamp,
                          message.timestamp,
                        );
                      const startsNewAuthorRun =
                        !previousMessage ||
                        previousMessage.authorIdentityId !==
                          message.authorIdentityId;
                      const showAvatar =
                        !nextMessage ||
                        nextMessage.authorIdentityId !==
                          message.authorIdentityId;

                      return (
                        <Fragment key={message.id}>
                          {startsNewDay && (
                            <DateSeparator
                              label={formatDateSeparator(message.timestamp)}
                            />
                          )}
                          <div
                            className={
                              startsNewDay || startsNewAuthorRun
                                ? 'mt-4'
                                : 'mt-1'
                            }
                          >
                            <MessageBubble
                              message={message}
                              currentIdentityId={session.identity.id}
                              authorName={
                                message.mine
                                  ? session.identity.profile.name
                                  : memberDisplayName(
                                      memberIdentities[
                                        message.authorIdentityId
                                      ],
                                      message.authorIdentityId,
                                    )
                              }
                              authorPicture={
                                message.mine
                                  ? memberPictures[session.identity.id]
                                  : memberPictures[message.authorIdentityId]
                              }
                              onAttachmentOpen={(attachmentIndex) =>
                                void openAttachment(
                                  message.attachments[attachmentIndex],
                                )
                              }
                              onAttachmentPreview={loadAttachmentPreview}
                              onAvatarClick={(event) =>
                                openMessageAuthorProfile(
                                  message,
                                  profileAnchorFromTarget(event.currentTarget),
                                )
                              }
                              onMessageMenuOpen={(targetMessage, x, y) =>
                                setMessageContextMenu({
                                  message: targetMessage,
                                  x,
                                  y,
                                })
                              }
                              onReactionToggle={(
                                targetMessage,
                                emoji,
                                reacted,
                              ) =>
                                void handleToggleChannelMessageReaction(
                                  targetMessage,
                                  emoji,
                                  reacted,
                                )
                              }
                              onReplyReferenceClick={handleReplyReferenceClick}
                              onRetryMessage={retryChannelMessage}
                              reactionAuthorNames={reactionAuthorNames}
                              replyImage={
                                replyMessage?.attachments.find((attachment) =>
                                  isBrowserPreviewImage(attachment.contentType),
                                ) ?? message.replyPreview?.image
                              }
                              replyAuthorName={
                                replyMessage
                                  ? memberDisplayName(
                                      memberIdentities[
                                        replyMessage.authorIdentityId
                                      ],
                                      replyMessage.authorIdentityId,
                                    )
                                  : message.replyPreview
                                    ? memberDisplayName(
                                        memberIdentities[
                                          message.replyPreview.authorIdentityId
                                        ],
                                        message.replyPreview.authorIdentityId,
                                      )
                                    : undefined
                              }
                              replyPreview={
                                replyMessage?.content ??
                                message.replyPreview?.content
                              }
                              showAvatar={showAvatar}
                            />
                          </div>
                        </Fragment>
                      );
                    })}
                  {visibleMessages.length === 0 &&
                    messageState !== 'loading' && (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center text-sm text-white/55">
                        {copy.communities.emptyChannel}
                      </div>
                    )}
                  <div ref={bottomRef} />
                </div>
              </div>
              {(newChannelMessageCount > 0 || isAwayFromBottom) && (
                <button
                  type="button"
                  onClick={() => {
                    setNewChannelMessageCount(0);
                    setIsAwayFromBottom(false);

                    if (selectedChannelId) onChannelViewed?.(selectedChannelId);
                    bottomRef.current?.scrollIntoView({ block: 'end' });
                  }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-fuchsia-500 px-4 py-2 text-xs font-black text-white shadow-xl shadow-fuchsia-950/30 transition hover:bg-fuchsia-400"
                >
                  {newChannelMessageCount > 0
                    ? newChannelMessageCount > 1
                      ? copy.chat.newMessages
                      : copy.chat.newMessage
                    : copy.chat.jumpToLatest}
                </button>
              )}
            </div>
            {typingIdentityIds.length > 0 && (
              <TypingIndicator
                identityIds={typingIdentityIds}
                memberIdentities={memberIdentities}
              />
            )}
            <Composer
              disabled={messageState === 'loading' || !communityKey}
              draft={draft}
              error={sendError}
              focusKey={selectedChannelId}
              onCancelReply={() => setReplyTarget(null)}
              onDraftChange={handleDraftChange}
              onEscape={() => undefined}
              onSend={handleSendChannelMessage}
              progress={attachmentProgress}
              replyTo={replyTarget}
              replyToAuthorName={
                replyTarget
                  ? memberDisplayName(
                      memberIdentities[replyTarget.authorIdentityId],
                      replyTarget.authorIdentityId,
                    )
                  : undefined
              }
            />
          </>
        )}
      </section>

      <aside className="glass-panel hidden h-full min-h-0 overflow-y-auto rounded-none p-4 xl:block">
        <button
          type="button"
          onClick={() => setMemberOpen(true)}
          className="mb-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
        >
          {copy.communities.addMember}
        </button>
        <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
          {copy.communities.members}
        </div>
        <div className="space-y-2">
          {members.map((member) => (
            <MemberRow
              key={member.identityId}
              identity={member.identity}
              identityId={member.identityId}
              onClick={(event) =>
                openMemberProfile(
                  member,
                  profileAnchorFromTarget(event.currentTarget),
                )
              }
              owner={member.identityId === community.ownerIdentityId}
              pictureUrl={member.pictureUrl}
              presence={presenceByIdentityId[member.identityId]}
            />
          ))}
        </div>
      </aside>

      {mobileMembersOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/50 xl:hidden"
            onClick={onMobileMembersClose}
            aria-label={copy.dialog.close}
          />
          <aside className="glass-panel fixed inset-y-0 right-0 z-50 w-[86vw] max-w-[360px] overflow-y-auto rounded-none p-4 xl:hidden">
            <button
              type="button"
              onClick={() => setMemberOpen(true)}
              className="mb-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
            >
              {copy.communities.addMember}
            </button>
            <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
              {copy.communities.members}
            </div>
            <div className="space-y-2">
              {members.map((member) => (
                <MemberRow
                  key={member.identityId}
                  identity={member.identity}
                  identityId={member.identityId}
                  onClick={(event) =>
                    openMemberProfile(
                      member,
                      profileAnchorFromTarget(event.currentTarget),
                    )
                  }
                  owner={member.identityId === community.ownerIdentityId}
                  pictureUrl={member.pictureUrl}
                  presence={presenceByIdentityId[member.identityId]}
                />
              ))}
            </div>
          </aside>
        </>
      )}

      {bannerViewerOpen && bannerUrl && (
        <ImageLightbox
          images={[
            {
              alt: community.name,
              filename: community.banner ?? community.name,
              url: bannerUrl,
            },
          ]}
          initialIndex={0}
          onClose={() => setBannerViewerOpen(false)}
        />
      )}
      {manageOpen && (
        <ManageCommunityDialog
          community={community}
          onClose={() => setManageOpen(false)}
          onCommunityUpdated={onCommunityUpdated}
          session={session}
        />
      )}
      {memberOpen && (
        <AddCommunityMemberDialog
          communityId={community.id}
          onClose={() => setMemberOpen(false)}
          onSessionUpdated={onSessionUpdated}
          session={session}
        />
      )}
      {profileViewer && (
        <UserProfileDialog
          anchor={profileViewer.anchor}
          identity={profileViewer.identity}
          identityId={profileViewer.identityId}
          name={memberDisplayName(
            profileViewer.identity,
            profileViewer.identityId,
          )}
          nodeNetworks={nodeNetworks}
          onClose={() => setProfileViewer(null)}
          onOpenConversation={
            profileViewer.identityId === session.identity.id ||
            !onOpenConversationWithIdentity
              ? undefined
              : () =>
                  onOpenConversationWithIdentity(
                    profileViewer.identityId,
                    profileViewer.identity,
                  )
          }
          picture={profileViewer.pictureUrl}
          presence={presenceByIdentityId[profileViewer.identityId]}
        />
      )}
      {messageContextMenu && (
        <MessageContextMenu
          currentIdentityId={session.identity.id}
          menu={messageContextMenu}
          onClose={() => setMessageContextMenu(null)}
          onDelete={
            messageContextMenu.message.mine
              ? () =>
                  void handleDeleteChannelMessage(messageContextMenu.message)
              : undefined
          }
          onReply={() => {
            setReplyTarget(messageContextMenu.message);
            setMessageContextMenu(null);
          }}
          onReactionToggle={(message, emoji, reacted) =>
            void handleToggleChannelMessageReaction(message, emoji, reacted)
          }
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
      {communityDataOpen && (
        <ConversationDataDialog
          data={communityData}
          onClose={() => setCommunityDataOpen(false)}
          title={copy.communities.communityDataTitle}
        />
      )}
      {communityKeyDialog && (
        <ConversationKeyDialog
          encryptedConversationKey={communityKeyEncrypted}
          error={communityKeyError}
          input={communityKeyInput}
          mode={communityKeyDialog}
          onClose={closeCommunityKeyDialog}
          onCopy={() => void copyCommunityKey()}
          onImport={() => void importCommunityKey()}
          onInputChange={setCommunityKeyInput}
          saving={communityKeySaving}
        />
      )}
    </>
  );
}

function VoiceChannelButton({
  active,
  channel,
  onJoin,
  onParticipantClick,
  participants,
}: {
  active: boolean;
  channel: { id: string; name: string };
  onJoin: () => void;
  onParticipantClick: (
    participant: {
      deafened?: boolean;
      identityId: string;
      muted: boolean;
      name: string;
      picture?: null | string;
      speaking?: boolean;
    },
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  participants: Array<{
    deafened?: boolean;
    identityId: string;
    muted: boolean;
    name: string;
    picture?: null | string;
    speaking?: boolean;
  }>;
}) {
  return (
    <div
      className={cx(
        'overflow-hidden rounded-2xl',
        active ? 'bg-white/10' : 'bg-white/5',
      )}
    >
      <button
        type="button"
        onClick={onJoin}
        className={cx(
          'flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-black transition',
          active ? 'text-emerald-200' : 'text-white/75 hover:bg-white/8',
        )}
        title={copy.calls.joinVoice}
      >
        <span className="text-emerald-300">
          <VoiceIcon />
        </span>
        <span className="min-w-0 flex-1 truncate">{channel.name}</span>
      </button>
      {participants.length > 0 && (
        <div className="space-y-1 px-3 pb-3">
          {participants.map((participant) => (
            <button
              key={participant.identityId}
              type="button"
              onClick={(event) => onParticipantClick(participant, event)}
              className={cx(
                'flex w-full items-center gap-2 rounded-2xl border px-2 py-1.5 text-left text-sm transition hover:bg-white/8 hover:text-white',
                active && participant.speaking
                  ? 'border-emerald-300/80 bg-emerald-400/10 text-emerald-100 shadow-[0_0_0_2px_rgba(110,231,183,0.18)]'
                  : 'border-transparent text-white/55',
              )}
            >
              <div
                className={cx(
                  'grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-xs font-black text-slate-950',
                  active &&
                    participant.speaking &&
                    'ring-2 ring-emerald-200/60',
                )}
              >
                {participant.picture ? (
                  <img
                    src={participant.picture}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  participant.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <span className="min-w-0 flex-1 truncate">
                {voiceParticipantName(participant.name)}
              </span>
              <VoiceParticipantStatusIcons participant={participant} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VoiceParticipantStatusIcons({
  participant,
}: {
  participant: { deafened?: boolean; muted: boolean };
}) {
  if (!participant.muted && !participant.deafened) return null;

  return (
    <span className="flex shrink-0 items-center gap-1 text-fuchsia-200 [&_svg]:h-4 [&_svg]:w-4">
      {participant.muted && <MicrophoneIcon muted />}
      {participant.deafened && <HeadphonesIcon deafened />}
    </span>
  );
}

function voiceParticipantName(name: string): string {
  return name.replace(/\s*\(@[^)]*\)\s*$/, '').trim() || name;
}

function TypingIndicator({
  identityIds,
  memberIdentities,
}: {
  identityIds: string[];
  memberIdentities: Record<string, IdentityResource>;
}) {
  return (
    <div className="px-4 pb-2 text-xs font-black text-white/45 sm:px-6">
      {typingLabel(identityIds, memberIdentities)}
    </div>
  );
}

function typingLabel(
  identityIds: string[],
  memberIdentities: Record<string, IdentityResource>,
): string {
  const [firstIdentityId, secondIdentityId] = identityIds;
  const firstName = firstIdentityId
    ? memberDisplayName(memberIdentities[firstIdentityId], firstIdentityId)
    : '';

  if (identityIds.length === 1) return `${firstName} is typing...`;

  if (identityIds.length === 2 && secondIdentityId) {
    return `${firstName} and ${memberDisplayName(
      memberIdentities[secondIdentityId],
      secondIdentityId,
    )} are typing...`;
  }

  return `${firstName} and ${identityIds.length - 1} more are typing...`;
}

function resolveCommunityChannelId(
  channelId: null | string | undefined,
  channels: CommunityTextChannel[],
): null | string {
  if (channelId && channels.some((channel) => channel.id === channelId)) {
    return channelId;
  }

  return channels[0]?.id ?? null;
}

function mergeChatMessages(
  currentMessages: ChatMessage[],
  incomingMessages: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();

  for (const message of currentMessages) byId.set(message.id, message);
  for (const message of incomingMessages) byId.set(message.id, message);

  return [...byId.values()].sort(
    (left, right) => left.timestamp - right.timestamp,
  );
}

function realtimeStringAttribute(
  event: RealtimeDomainEvent,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = event.attributes[key];

    if (typeof value === 'string' && value.length > 0) return value;
  }

  return undefined;
}

function realtimeMessageAttribute(
  event: RealtimeDomainEvent,
): MessageResource | null {
  const value = event.attributes.message;

  return value && typeof value === 'object' ? (value as MessageResource) : null;
}
