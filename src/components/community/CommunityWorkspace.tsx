import {
  EncryptedPayload,
  PrivateKey,
  PublicKey,
  StringValueObject,
  UUID,
} from '@haskou/value-objects';
import {
  lazy,
  type MouseEvent,
  type ReactNode,
  Suspense,
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
  AttachmentUploadOptions,
  ChatMessage,
  IdentityPresence,
  IdentityResource,
  MessageAttachment,
  MessageReplyPreview,
  MessageResource,
  SelectablePresenceStatus,
  Session,
  StickerMessageReference,
} from '../../domain/types';
import type { RealtimeDomainEvent } from '../../infrastructure/realtime/RealtimeGateway';

import { pigeonApplication } from '../../application/applicationContainer';
import { pendingFileAttachments } from '../../domain/attachments/pendingFileAttachments';
import { encryptCommunityChannelPayload } from '../../domain/communities/communityChannelPayloadCipher';
import { CommunityMessageDecryptWorkerClient } from '../../domain/communities/CommunityMessageDecryptWorkerClient';
import {
  communityTextChannels,
  communityVoiceChannels,
} from '../../domain/communities/communityChannels';
import { firstMessageLinkPreviewUrl } from '../../domain/messages/linkPreviewUrls';
import { updateMessageReaction } from '../../domain/messages/updateMessageReaction';
import { copy } from '../../i18n/en';
import { isBrowserPreviewImage } from '../../utils/browserPreview';
import { cx } from '../../utils/classNameHelper';
import { shortId } from '../../utils/formatting';
import { normalizeIdentityId } from '../../utils/identityId';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { Composer } from '../chat/Composer';
import { StickerPackPreviewDialog } from '../chat/StickerPackPreviewDialog';
import { TypingIndicator } from '../chat/TypingIndicator';
import { useAttachmentDownload } from '../chat/useAttachmentDownload';
import {
  profileAnchorFromTarget,
  type ProfilePopoverAnchor,
} from '../profile/profilePopoverAnchor';
import type { MessageContextMenuState } from '../workspace/MessageContextMenu';
import { UserProfileDropdown } from '../workspace/SessionIdentityDropdown';
import { CommunityHeader } from './CommunityHeader';
import { loadPublicImage } from './communityImages';
import {
  CommunityMembersPanel,
  type CommunityMemberListItem,
} from './CommunityMembersPanel';
import { memberDisplayName, memberPrimaryName } from './communityMemberNames';
import { CommunityMessageTimeline } from './CommunityMessageTimeline';
import {
  mergeChatMessages,
  realtimeMessageAttribute,
  realtimeStringAttribute,
  resolveCommunityChannelId,
} from './communityWorkspaceHelpers';
import { VoiceChannelButton } from './CommunityVoiceChannelButton';
import { useCommunityMembers } from './useCommunityMembers';

const AddCommunityMemberDialog = lazy(() =>
  import('./AddCommunityMemberDialog').then((module) => ({
    default: module.AddCommunityMemberDialog,
  })),
);
const ConversationDataDialog = lazy(() =>
  import('../workspace/ConversationDataDialog').then((module) => ({
    default: module.ConversationDataDialog,
  })),
);
const ConversationKeyDialog = lazy(() =>
  import('../workspace/ConversationKeyDialog').then((module) => ({
    default: module.ConversationKeyDialog,
  })),
);
const ImageLightbox = lazy(() =>
  import('../chat/ImageLightbox').then((module) => ({
    default: module.ImageLightbox,
  })),
);
const ManageCommunityDialog = lazy(() =>
  import('./ManageCommunityDialog').then((module) => ({
    default: module.ManageCommunityDialog,
  })),
);
const MessageContextMenu = lazy(() =>
  import('../workspace/MessageContextMenu').then((module) => ({
    default: module.MessageContextMenu,
  })),
);
const RawMessageDialog = lazy(() =>
  import('../workspace/RawMessageDialog').then((module) => ({
    default: module.RawMessageDialog,
  })),
);
const UserProfileDialog = lazy(() =>
  import('../profile/UserProfileDialog').then((module) => ({
    default: module.UserProfileDialog,
  })),
);

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

type MemberView = CommunityMemberListItem & {
  anchor?: ProfilePopoverAnchor;
};

type CommunityPendingSend = {
  attachmentUpload: AttachmentUploadOptions;
  attachments: File[];
  channelId: string;
  content: string;
  replyTarget: ChatMessage | null;
  sticker?: StickerMessageReference;
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
    ...(message.sticker ? { sticker: message.sticker } : {}),
  };
}

async function createLinkPreviewForContent(
  session: Session,
  content: string,
) {
  const url = firstMessageLinkPreviewUrl(content);

  if (!url) return undefined;

  return await pigeonApplication.createLinkPreview(session, url).catch(
    () => undefined,
  );
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
  const [stickerPackPreview, setStickerPackPreview] =
    useState<StickerMessageReference | null>(null);
  const [attachmentProgress, setAttachmentProgress] =
    useState<AttachmentProgress | null>(null);
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
  const communityMessageDecryptWorkerRef =
    useRef<CommunityMessageDecryptWorkerClient | null>(null);
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
      ? (activeCall.channelId ?? null)
      : null;
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

  const openMemberProfile = useCallback(
    (member: MemberView, anchor?: ProfilePopoverAnchor) =>
      setProfileViewer({ ...member, anchor }),
    [],
  );
  const joinVoiceChannel = useCallback(
    (channel: CommunityVoiceChannel) => onJoinVoiceChannel?.(channel),
    [onJoinVoiceChannel],
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
    async (channelId: string, rawMessage: MessageResource): Promise<ChatMessage> => {
      const [projected] = await projectChannelMessages(channelId, [rawMessage]);

      return projected;
    },
    [projectChannelMessages],
  );

  const loadChannelMessages = useCallback(
    async (channelId: string, beforeMessageId?: string) => {
      const result = await pigeonApplication.listCommunityChannelMessages(
        session,
        community.id,
        channelId,
        { beforeMessageId },
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
    attachmentUpload: AttachmentUploadOptions,
  ): Promise<void> => {
    if (!selectedChannelId) return Promise.resolve();

    onTypingActive?.(selectedChannelId, false);
    sendPendingChannelMessage({
      attachmentUpload,
      attachments,
      channelId: selectedChannelId,
      content,
      replyTarget,
    });
    setReplyTarget(null);

    return Promise.resolve();
  };
  const handleSendChannelSticker = (
    sticker: StickerMessageReference,
  ): Promise<void> => {
    if (!selectedChannelId) return Promise.resolve();

    onTypingActive?.(selectedChannelId, false);
    sendPendingChannelMessage({
      attachmentUpload: {},
      attachments: [],
      channelId: selectedChannelId,
      content: '',
      replyTarget,
      sticker,
    });
    setReplyTarget(null);

    return Promise.resolve();
  };
  const handleStickerClick = (sticker: StickerMessageReference) => {
    setStickerPackPreview(sticker);
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
        content: payload.sticker
          ? ''
          : payload.content ||
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
        sticker: payload.sticker,
        timestamp,
      },
    ]);
    scrollChannelToBottom('smooth');

    sendQueueRef.current = sendQueueRef.current.then(async () => {
      try {
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
            payload.attachmentUpload,
          );
        const linkPreview = payload.sticker
          ? undefined
          : await createLinkPreviewForContent(session, payload.content);
        const encryptedPayload = await encryptCommunityChannelPayload({
          attachments: messageAttachments,
          authorIdentityId: session.identity.id,
          channelId: payload.channelId,
          communityId: community.id,
          communityKey: session.keychain.conversations[community.id],
          content: payload.content,
          linkPreview,
          replyPreview: replyPreviewFromMessage(payload.replyTarget),
          replyToMessageId: payload.replyTarget?.id,
          sticker: payload.sticker,
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
        const projected = await projectChannelMessage(payload.channelId, created);

        if (payload.sticker) {
          void pigeonApplication.markStickerUsed(session, payload.sticker);
        }

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

  const { loadAttachmentPreview, openAttachment } = useAttachmentDownload({
    errorMessage: copy.composer.attachmentDownloadError,
    onErrorChange: setSendError,
    onProgressChange: setAttachmentProgress,
  });

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

    void projectChannelMessage(channelId, message)
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
                              onJoin={joinVoiceChannel}
                              onParticipantClick={openVoiceParticipantProfile}
                              participants={
                                voiceParticipantsByChannelId.get(channel.id) ??
                                []
                              }
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
        <CommunityHeader
          avatarUrl={avatarUrl}
          channelEncryptionReady={channelEncryptionReady}
          channelEncryptionTooltip={channelEncryptionTooltip}
          community={community}
          communityLeaveError={communityLeaveError}
          communityMenuOpen={communityMenuOpen}
          menuContent={
            communityMenuOpen && (
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
            )
          }
          networkName={networkName}
          onCommunityMenuToggle={() =>
            setCommunityMenuOpen((isOpen) => !isOpen)
          }
          onOpenMobileSidebar={onOpenMobileSidebar}
          onRealtimeEventsOpen={onRealtimeEventsOpen}
          realtimeStatus={realtimeStatus}
          selectedChannel={selectedChannel}
        />

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
              loadAttachmentPreview={loadAttachmentPreview}
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
              onAttachmentOpen={(attachment) => void openAttachment(attachment)}
              onAuthorProfileOpen={(message, target) =>
                openMessageAuthorProfile(
                  message,
                  profileAnchorFromTarget(target),
                )
              }
              onJumpToLatest={() => {
                setNewChannelMessageCount(0);
                setIsAwayFromBottom(false);

                if (selectedChannelId) onChannelViewed?.(selectedChannelId);
                bottomRef.current?.scrollIntoView({ block: 'end' });
              }}
              onMessageMenuOpen={(message, x, y) =>
                setMessageContextMenu({ message, x, y })
              }
              onReactionToggle={(message, emoji, reacted) =>
                void handleToggleChannelMessageReaction(message, emoji, reacted)
              }
              onReplyReferenceClick={handleReplyReferenceClick}
              onRetryMessage={retryChannelMessage}
              onScroll={handleMessagesScroll}
              onStickerClick={handleStickerClick}
              reactionAuthorNames={reactionAuthorNames}
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
              disabled={messageState === 'loading' || !communityKey}
              draft={draft}
              error={sendError}
              focusKey={selectedChannelId}
              onCancelReply={() => setReplyTarget(null)}
              onDraftChange={handleDraftChange}
              onEscape={() => undefined}
              onSend={handleSendChannelMessage}
              onStickerSend={handleSendChannelSticker}
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
              session={session}
            />
            {stickerPackPreview && (
              <StickerPackPreviewDialog
                onClose={() => setStickerPackPreview(null)}
                onStickerSend={handleSendChannelSticker}
                session={session}
                sticker={stickerPackPreview}
              />
            )}
          </>
        )}
      </section>

      <CommunityMembersPanel
        community={community}
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

      <Suspense fallback={null}>
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
            name={memberPrimaryName(
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
      </Suspense>
    </>
  );
}
