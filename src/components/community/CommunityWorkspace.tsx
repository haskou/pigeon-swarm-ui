import { EncryptedPayload, PrivateKey, PublicKey } from '@haskou/value-objects';
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
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { RealtimeDomainEvent } from '../../infrastructure/realtime/RealtimeGateway';
import type {
  Community,
  CommunityChannel,
  CommunityTextChannel,
  CommunityVoiceChannel,
  ConversationKeyEntry,
  AttachmentProgress,
  ChatMessage,
  IdentityResource,
  MessageAttachment,
  MessageResource,
  Session,
} from '../../domain/types';
import type {
  CallParticipant,
  CallSession,
} from '../../domain/calls/CallSession';

import { pigeonApplication } from '../../application/applicationContainer';
import { pendingFileAttachments } from '../../domain/attachments/pendingFileAttachments';
import {
  communityChannels,
  communityTextChannels,
  communityVoiceChannels,
  splitCommunityChannels,
} from '../../domain/communities/communityChannels';
import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import {
  formatDateSeparator,
  isSameDay,
  shortId,
} from '../../utils/formatting';
import {
  identityName,
  identityPicture,
  profilePictureDataUrl,
} from '../../utils/identityDisplay';
import { normalizeIdentityId } from '../../utils/identityId';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { Field } from '../auth/Field';
import { Composer } from '../chat/Composer';
import { DateSeparator } from '../chat/DateSeparator';
import { ImageLightbox } from '../chat/ImageLightbox';
import { MessageBubble } from '../chat/MessageBubble';
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

interface CommunityWorkspaceProps {
  activeChannelId?: null | string;
  activeCall?: CallSession | null;
  channelUnreadCounts?: Record<string, number>;
  community: Community;
  mobileMembersOpen: boolean;
  mobileSidebarOpen: boolean;
  mobileRail?: ReactNode;
  nodeNetworks: NodeNetwork[];
  onChannelSelected: (channelId: string) => void;
  onChannelViewed?: (channelId: string) => void;
  onCommunityUpdated: (community: Community) => void;
  onCallEnd?: () => void;
  onCallToggleDeafen?: () => void;
  onCallToggleMute?: () => void;
  onLogout: () => void;
  onMobileMembersClose: () => void;
  onMobileSidebarClose: () => void;
  onOpenMobileSidebar: () => void;
  onJoinVoiceChannel?: (channel: CommunityVoiceChannel) => void;
  onRealtimeEventsOpen?: () => void;
  onSessionUpdated: (session: Session) => void;
  realtimeEvent?: null | RealtimeDomainEvent;
  realtimeStatus?: 'connected' | 'reconnecting';
  session: Session;
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
};

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
  mobileSidebarOpen,
  mobileRail,
  nodeNetworks,
  onChannelSelected,
  onChannelViewed,
  onCommunityUpdated,
  onCallEnd,
  onCallToggleDeafen,
  onCallToggleMute,
  onLogout,
  onMobileMembersClose,
  onMobileSidebarClose,
  onOpenMobileSidebar,
  onJoinVoiceChannel,
  onRealtimeEventsOpen,
  onSessionUpdated,
  realtimeEvent,
  realtimeStatus = 'connected',
  session,
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
  const [attachmentProgress, setAttachmentProgress] =
    useState<AttachmentProgress | null>(null);
  const [memberIdentities, setMemberIdentities] = useState<
    Record<string, IdentityResource>
  >({});
  const [memberPictures, setMemberPictures] = useState<Record<string, string>>(
    {},
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerViewerOpen, setBannerViewerOpen] = useState(false);
  const [channelDataOpen, setChannelDataOpen] = useState(false);
  const [communityKeyDialog, setCommunityKeyDialog] = useState<
    'add' | 'copy' | null
  >(null);
  const [communityKeyEncrypted, setCommunityKeyEncrypted] = useState('');
  const [communityKeyError, setCommunityKeyError] = useState<string | null>(
    null,
  );
  const [communityKeyInput, setCommunityKeyInput] = useState('');
  const [communityKeySaving, setCommunityKeySaving] = useState(false);
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [messageContextMenu, setMessageContextMenu] =
    useState<MessageContextMenuState | null>(null);
  const [profileViewer, setProfileViewer] = useState<MemberView | null>(null);
  const [rawMessage, setRawMessage] = useState<ChatMessage | null>(null);
  const [failedSends, setFailedSends] = useState<
    Record<string, CommunityPendingSend>
  >({});
  const [isAwayFromBottom, setIsAwayFromBottom] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const keepChannelBottomUntilRef = useRef(0);
  const messageStateRef = useRef<'error' | 'idle' | 'loading'>('idle');
  const memberIdentitiesRef = useRef<Record<string, IdentityResource>>({});
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
    onChannelSelectedRef.current = onChannelSelected;
    onChannelViewedRef.current = onChannelViewed;
  }, [onChannelSelected, onChannelViewed]);
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

      if (parsed.conversationId !== community.id || !parsed.privateKey) {
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
  const callParticipantForIdentity = useCallback(
    (identityId: string): CallParticipant => {
      const identity =
        identityId === session.identity.id
          ? session.identity
          : memberIdentities[identityId];

      return {
        identity,
        identityId,
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
  const channelData = useMemo(
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
      communityMemberIds.map(async (identityId) => {
        try {
          const identity = await pigeonApplication.getIdentity(identityId);
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
  }, [communityMemberIds]);

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

  const refreshCommunity = async () => {
    onCommunityUpdated(
      await pigeonApplication.getCommunity(session, community.id),
    );
  };

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
            await pigeonApplication.getIdentity(identityId),
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

    sendPendingChannelMessage({
      attachments,
      channelId: selectedChannelId,
      content,
    });

    return Promise.resolve();
  };

  const sendPendingChannelMessage = (payload: CommunityPendingSend) => {
    setSendError(null);
    const timestamp = Date.now();
    const optimisticId = `pending:${community.id}:${payload.channelId}:${timestamp}:${crypto.randomUUID()}`;

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
          communityKey: session.keychain.conversations[community.id],
          communityId: community.id,
          content: payload.content,
          recipients: Object.values(identities),
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
    if (selectedChannelId === resolvedChannelId) return;

    setSelectedChannelId(resolvedChannelId);
    setNewChannelMessageCount(0);

    if (resolvedChannelId) {
      onChannelViewedRef.current?.(resolvedChannelId);
      onChannelSelectedRef.current(resolvedChannelId);
    }
  }, [resolvedChannelId, selectedChannelId]);

  useEffect(() => {
    if (!selectedChannelId) {
      setMessages([]);
      setMessageCursor(null);
      setMessageLoadState('idle');

      return undefined;
    }

    let cancelled = false;

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
      realtimeEvent.type !== 'communities.v1.channel.message.was_sent' &&
      realtimeEvent.type !== 'communities.v1.call.event.was_recorded'
    ) {
      return;
    }

    const message = realtimeMessageAttribute(realtimeEvent);

    if (!message) return;

    const shouldStickToBottom =
      isScrolledNearBottom() ||
      message.authorIdentityId === session.identity.id;
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
        <div className="grid h-full grid-cols-[82px_minmax(0,1fr)] gap-3 lg:block">
          <div className="lg:hidden">{mobileRail}</div>
          <div className="glass-panel-strong flex h-full min-h-0 flex-col rounded-none p-4 sm:rounded-[2rem]">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {copy.communities.privateCommunity}
              </div>
              <div className="mt-3 overflow-hidden rounded-3xl bg-white/8 text-left">
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
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
                    {copy.communities.noChannels}
                  </div>
                ) : visibleTextChannels.length === 0 &&
                  visibleVoiceChannels.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
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
              onCallEnd={onCallEnd}
              onCallToggleDeafen={onCallToggleDeafen}
              onCallToggleMute={onCallToggleMute}
              onLogout={onLogout}
              onSessionUpdated={onSessionUpdated}
              session={session}
            />
          </div>
        </div>
      </aside>

      <section className="glass-panel-strong flex min-h-0 flex-col overflow-hidden rounded-none sm:rounded-[2rem]">
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
            {selectedChannel ? (
              <div className="relative ml-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setChannelMenuOpen((isOpen) => !isOpen)}
                  className="grid h-11 w-11 place-items-center rounded-2xl text-xl font-black text-white/70 transition hover:bg-white/15"
                  aria-label={copy.chat.conversationMenu}
                  aria-expanded={channelMenuOpen}
                >
                  ⋮
                </button>
                {channelMenuOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-30 cursor-default"
                      onClick={() => setChannelMenuOpen(false)}
                      aria-label={copy.dialog.close}
                    />
                    <div className="absolute right-0 top-[calc(100%+.5rem)] z-40 min-w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#15172d] p-1 text-sm shadow-2xl shadow-black/40">
                      <button
                        type="button"
                        onClick={() => {
                          setChannelDataOpen(true);
                          setChannelMenuOpen(false);
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
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

                          setChannelMenuOpen(false);
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
                      >
                        {communityKey
                          ? copy.chat.copyPrivateKey
                          : copy.chat.addPrivateKey}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </header>

        {!selectedChannel ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div className="max-w-md">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-3xl font-black">
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
                  <ChannelMessageSkeleton />
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
                      <div className="w-full max-w-md rounded-3xl border border-rose-300/20 bg-rose-500/10 p-5 text-center text-sm text-rose-100">
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
                              onReplyReferenceClick={() => undefined}
                              onRetryMessage={retryChannelMessage}
                              showAvatar={showAvatar}
                            />
                          </div>
                        </Fragment>
                      );
                    })}
                  {visibleMessages.length === 0 &&
                    messageState !== 'loading' && (
                      <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-center text-sm text-white/55">
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
            <Composer
              disabled={messageState === 'loading' || !communityKey}
              draft={draft}
              error={sendError}
              onDraftChange={setDraft}
              onEscape={() => undefined}
              onSend={handleSendChannelMessage}
              progress={attachmentProgress}
            />
          </>
        )}
      </section>

      <aside className="glass-panel hidden h-full min-h-0 overflow-y-auto rounded-[2rem] p-4 xl:block">
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
          onCommunityUpdated={onCommunityUpdated}
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
          picture={profileViewer.pictureUrl}
        />
      )}
      {messageContextMenu && (
        <MessageContextMenu
          menu={messageContextMenu}
          onClose={() => setMessageContextMenu(null)}
          onDelete={
            messageContextMenu.message.mine
              ? () =>
                  void handleDeleteChannelMessage(messageContextMenu.message)
              : undefined
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
      {channelDataOpen && (
        <ConversationDataDialog
          data={channelData}
          onClose={() => setChannelDataOpen(false)}
          title={copy.communities.channelDataTitle}
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

function ManageCommunityDialog({
  community,
  onClose,
  onCommunityUpdated,
  session,
}: {
  community: Community;
  onClose: () => void;
  onCommunityUpdated: (community: Community) => void;
  session: Session;
}) {
  type ManagedCommunityChannel = CommunityChannel & { pending?: boolean };

  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [currentBannerUrl, setCurrentBannerUrl] = useState<string | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'text' | 'voice'>('text');
  const [channelOrder, setChannelOrder] = useState<ManagedCommunityChannel[]>(
    communityChannels(community),
  );
  const [deletedChannelIds, setDeletedChannelIds] = useState<string[]>([]);
  const [channelDrafts, setChannelDrafts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        communityChannels(community).map((channel) => [
          channel.id,
          channel.name,
        ]),
      ),
  );
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!avatar) {
      setAvatarPreview(null);

      return undefined;
    }

    const nextPreview = URL.createObjectURL(avatar);

    setAvatarPreview(nextPreview);

    return () => URL.revokeObjectURL(nextPreview);
  }, [avatar]);

  useEffect(() => {
    if (!banner) {
      setBannerPreview(null);

      return undefined;
    }

    const nextPreview = URL.createObjectURL(banner);

    setBannerPreview(nextPreview);

    return () => URL.revokeObjectURL(nextPreview);
  }, [banner]);

  useEffect(() => {
    let cancelled = false;

    setCurrentAvatarUrl(null);
    if (!community.avatar) return undefined;

    void loadPublicImage(community.avatar).then((url) => {
      if (!cancelled) setCurrentAvatarUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.avatar]);

  useEffect(() => {
    let cancelled = false;

    setCurrentBannerUrl(null);
    if (!community.banner) return undefined;

    void loadPublicImage(community.banner).then((url) => {
      if (!cancelled) setCurrentBannerUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.banner]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const saveChanges = async (): Promise<boolean> => {
    if (state === 'loading') return false;

    if (
      channelOrder.some(
        (channel) => !(channelDrafts[channel.id] ?? channel.name).trim(),
      )
    ) {
      setError(copy.communities.channelError);

      return false;
    }

    setState('loading');
    setError(null);
    try {
      let updatedCommunity = await pigeonApplication.updateCommunity(
        session,
        community.id,
        {
          avatar: avatar ?? community.avatar,
          banner: banner ?? community.banner,
          description: description.trim(),
          name: name.trim(),
        },
      );

      for (const channelId of deletedChannelIds) {
        updatedCommunity = await pigeonApplication.deleteCommunityChannel(
          session,
          community.id,
          channelId,
        );
      }

      const updatedChannels: CommunityChannel[] = [];

      for (const channel of channelOrder) {
        const nextName = (channelDrafts[channel.id] ?? channel.name).trim();

        if (channel.pending) {
          updatedChannels.push(
            channel.type === 'text'
              ? await pigeonApplication.createCommunityTextChannel(
                  session,
                  community.id,
                  nextName,
                )
              : await pigeonApplication.createCommunityVoiceChannel(
                  session,
                  community.id,
                  nextName,
                ),
          );
        } else if (nextName === channel.name) {
          updatedChannels.push(channel);
        } else {
          updatedChannels.push(
            await pigeonApplication.renameCommunityChannel(
              session,
              community.id,
              channel.id,
              nextName,
            ),
          );
        }
      }

      onCommunityUpdated({
        ...updatedCommunity,
        ...splitCommunityChannels(updatedChannels),
      });
      return true;
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.updateError));
      return false;
    } finally {
      setState('idle');
    }
  };

  const finishManage = async () => {
    const saved = await saveChanges();

    if (!saved) return;
    onClose();
  };

  const createChannel = () => {
    const nextName = channelName.trim();

    if (!nextName || state === 'loading') return;

    setError(null);
    const channel: ManagedCommunityChannel =
      channelType === 'text'
        ? {
            createdAt: Date.now(),
            id: draftChannelId(),
            name: nextName,
            pending: true,
            type: 'text',
          }
        : {
            connectedIdentityIds: [],
            createdAt: Date.now(),
            id: draftChannelId(),
            name: nextName,
            pending: true,
            type: 'voice',
          };

    setChannelName('');
    setChannelOrder((current) => [...current, channel]);
    setChannelDrafts((current) => ({
      ...current,
      [channel.id]: channel.name,
    }));
  };

  const moveChannel = (channelId: string, direction: -1 | 1) => {
    const index = channelOrder.findIndex((channel) => channel.id === channelId);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= channelOrder.length) return;

    const nextChannels = [...channelOrder];
    const [channel] = nextChannels.splice(index, 1);

    nextChannels.splice(nextIndex, 0, channel);
    setChannelOrder(nextChannels);
  };

  const deleteChannel = (channel: ManagedCommunityChannel) => {
    if (!window.confirm(copy.communities.deleteChannelConfirm)) return;

    setChannelOrder((current) =>
      current.filter((candidate) => candidate.id !== channel.id),
    );
    setChannelDrafts((current) => {
      const { [channel.id]: _deleted, ...remaining } = current;

      return remaining;
    });

    if (!channel.pending) {
      setDeletedChannelIds((current) =>
        current.includes(channel.id) ? current : [...current, channel.id],
      );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 flex max-h-screen w-full flex-col overflow-hidden rounded-none p-5 shadow-2xl shadow-black/40 sm:max-h-[88vh] sm:max-w-5xl sm:rounded-[2rem]">
        <DialogHeader title={copy.communities.manage} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
            <div className="overflow-hidden rounded-[1.75rem] bg-black/25">
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="group relative block aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-slate-900 via-fuchsia-950 to-cyan-900"
                aria-label={copy.communities.banner}
              >
                {bannerPreview || currentBannerUrl ? (
                  <img
                    src={bannerPreview ?? currentBannerUrl ?? ''}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-4xl font-black text-white/80">
                    {community.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/0 text-3xl text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                  ✎
                </span>
              </button>
              <div className="relative px-4 pb-4">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="group relative -mt-8 grid h-20 w-20 place-items-center overflow-hidden rounded-[1.65rem] border-4 border-[#1f1f27] bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 shadow-xl shadow-black/35"
                  aria-label={copy.communities.avatar}
                >
                  {avatarPreview || currentAvatarUrl ? (
                    <img
                      src={avatarPreview ?? currentAvatarUrl ?? ''}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    community.name.slice(0, 1).toUpperCase()
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-black/0 text-2xl text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                    ✎
                  </span>
                </button>
                <div className="mt-4 grid gap-3">
                  <input
                    aria-label={copy.communities.name}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-lg font-black text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  />
                  <textarea
                    aria-label={copy.communities.description}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  />
                </div>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => setBanner(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-4">
              <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {copy.communities.channels}
              </div>
              <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
                {channelOrder.map((channel, index) => (
                  <div
                    key={channel.id}
                    className="flex items-center gap-2 rounded-2xl bg-white/8 p-2"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/55">
                      {channel.type === 'voice' ? <VoiceIcon /> : '#'}
                    </span>
                    <input
                      value={channelDrafts[channel.id] ?? channel.name}
                      onChange={(event) =>
                        setChannelDrafts((current) => ({
                          ...current,
                          [channel.id]: event.target.value,
                        }))
                      }
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                    />
                    <span className="hidden rounded-xl bg-black/25 px-2 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/35 sm:block">
                      {channel.type === 'voice'
                        ? copy.communities.voiceChannel
                        : copy.communities.textChannel}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveChannel(channel.id, -1)}
                      disabled={index === 0}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-black disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={copy.communities.moveChannelUp}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveChannel(channel.id, 1)}
                      disabled={index === channelOrder.length - 1}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-black disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={copy.communities.moveChannelDown}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteChannel(channel)}
                      disabled={state === 'loading'}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/15 text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={copy.communities.deleteChannel}
                      title={copy.communities.deleteChannel}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-1">
                {(['text', 'voice'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setChannelType(type)}
                    className={cx(
                      'rounded-xl px-3 py-2 text-xs font-black transition',
                      channelType === type
                        ? 'bg-white text-slate-950'
                        : 'text-white/55 hover:bg-white/10',
                    )}
                  >
                    {type === 'voice'
                      ? copy.communities.voiceChannel
                      : copy.communities.textChannel}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={channelName}
                  onChange={(event) => setChannelName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    void createChannel();
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  placeholder={copy.communities.addChannelPlaceholder}
                />
                <button
                  type="button"
                  onClick={() => void createChannel()}
                  disabled={!channelName.trim() || state === 'loading'}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-xs text-rose-100">
              {error}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void finishManage()}
          disabled={!name.trim() || state === 'loading'}
          className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {copy.profile.save}
        </button>
      </section>
    </div>,
    document.body,
  );
}

function AddCommunityMemberDialog({
  communityId,
  onClose,
  onCommunityUpdated,
  onSessionUpdated,
  session,
}: {
  communityId: string;
  onClose: () => void;
  onCommunityUpdated: (community: Community) => void;
  onSessionUpdated: (session: Session) => void;
  session: Session;
}) {
  const [identityInput, setIdentityInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'ready'>(
    'idle',
  );
  const [memberIdentity, setMemberIdentity] = useState<IdentityResource | null>(
    null,
  );
  const [memberPictureUrl, setMemberPictureUrl] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading'>('idle');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const identityId = normalizeIdentityLookup(identityInput);

    setError(null);
    setMemberIdentity(null);
    setMemberPictureUrl(null);

    if (!identityId) {
      setLookupState('idle');

      return undefined;
    }

    let cancelled = false;

    setLookupState('loading');
    const timeout = window.setTimeout(() => {
      void pigeonApplication
        .getIdentity(identityId)
        .then((identity) => {
          if (cancelled) return;

          setMemberIdentity(identity);
          setLookupState('ready');

          void loadIdentityPicture(identity).then((picture) => {
            if (!cancelled) setMemberPictureUrl(picture);
          });
        })
        .catch(() => {
          if (cancelled) return;
          setLookupState('idle');
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [identityInput]);

  const addMember = async () => {
    const identityId = memberIdentity?.id;

    if (!identityId || state === 'loading') return;

    setState('loading');
    setError(null);
    try {
      const result = await pigeonApplication.createCommunityInvitation(
        session,
        communityId,
        identityId,
      );
      if (
        result.keychain !== session.keychain ||
        result.keychainExternalIdentifier !== session.keychainExternalIdentifier
      ) {
        onSessionUpdated({
          ...session,
          keychain: result.keychain,
          keychainExternalIdentifier: result.keychainExternalIdentifier,
        });
      }
      onCommunityUpdated(
        await pigeonApplication.getCommunity(session, communityId),
      );
      onClose();
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.memberError));
    }
    setState('idle');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 w-full rounded-none p-5 shadow-2xl shadow-black/40 sm:max-w-md sm:rounded-[2rem]">
        <DialogHeader title={copy.communities.addMember} onClose={onClose} />
        <Field label={copy.communities.memberIdentity}>
          <input
            autoFocus
            value={identityInput}
            onChange={(event) => setIdentityInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              void addMember();
            }}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
            placeholder="@ada or identity id"
          />
        </Field>
        {lookupState === 'loading' && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-white/55">
            {copy.dialog.loadingIdentity}
          </div>
        )}
        {memberIdentity && lookupState === 'ready' && (
          <IdentityPreviewCard
            identity={memberIdentity}
            pictureUrl={memberPictureUrl}
          />
        )}
        {error && (
          <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-xs text-rose-100">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => void addMember()}
          disabled={!memberIdentity || state === 'loading'}
          className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {copy.communities.addMember}
        </button>
      </section>
    </div>,
    document.body,
  );
}

function IdentityPreviewCard({
  identity,
  pictureUrl,
}: {
  identity: IdentityResource;
  pictureUrl: null | string;
}) {
  const name = identityName(identity) ?? shortId(identity.id);
  const handle = identity.profile.handle
    ? `@${identity.profile.handle}`
    : identity.id;

  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
        {pictureUrl ? (
          <img src={pictureUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-black">{name}</p>
        <p className="truncate text-xs text-white/45">{handle}</p>
      </div>
    </div>
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
      identityId: string;
      muted: boolean;
      name: string;
      picture?: null | string;
    },
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  participants: Array<{
    identityId: string;
    muted: boolean;
    name: string;
    picture?: null | string;
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
              className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm text-white/55 transition hover:bg-white/8 hover:text-white"
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-xs font-black text-slate-950">
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
                {participant.name}
              </span>
              {participant.muted && (
                <span className="text-xs text-fuchsia-200">
                  {copy.calls.muted}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VoiceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M4 9.5v5h3.2L12 18.2V5.8L7.2 9.5H4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M9 4h6m-9 4h12m-10 0 .7 11h6.6L16 8M10 11v5m4-5v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DialogHeader({
  onClose,
  title,
}: {
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
        aria-label={copy.dialog.close}
      >
        ×
      </button>
    </div>
  );
}

function MemberRow({
  identity,
  identityId,
  onClick,
  owner,
  pictureUrl,
}: {
  identity?: IdentityResource;
  identityId: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  owner: boolean;
  pictureUrl: null | string;
}) {
  const name = memberPrimaryName(identity, identityId);
  const handle = identity?.profile.handle?.trim();

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-3 rounded-2xl bg-white/8 p-3 text-left transition hover:bg-white/12"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
        {pictureUrl ? (
          <img src={pictureUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black">{name}</div>
        <div className="truncate text-xs text-white/45">
          {handle ? `@${handle}` : shortId(identityId)}
        </div>
      </div>
      {owner && (
        <span
          className="absolute right-2 top-2 text-sm text-yellow-300"
          title={copy.communities.owner}
        >
          ♛
        </span>
      )}
    </button>
  );
}

function ChannelMessageSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className={cx(
            'flex animate-pulse items-end gap-2',
            item % 2 === 0 ? 'justify-start' : 'justify-end',
          )}
        >
          {item % 2 === 0 && (
            <div className="h-9 w-9 rounded-2xl bg-white/10" />
          )}
          <div
            className={cx(
              'rounded-3xl bg-white/10',
              item % 2 === 0 ? 'h-16 w-56' : 'h-12 w-44',
            )}
          />
          {item % 2 !== 0 && (
            <div className="h-9 w-9 rounded-2xl bg-white/10" />
          )}
        </div>
      ))}
    </div>
  );
}

function normalizeIdentityLookup(value: string): string {
  const trimmed = value.trim();

  return trimmed.startsWith('@') ? trimmed.slice(1).toLowerCase() : trimmed;
}

function draftChannelId(): string {
  return `draft:${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
}

async function loadIdentityPicture(
  identity: IdentityResource,
): Promise<string | null> {
  const directPicture = identityPicture(identity);

  if (directPicture) return directPicture;

  const pictureCid = identity.profile.picture?.trim();

  if (!pictureCid) return null;

  try {
    return await loadPublicImage(pictureCid);
  } catch {
    return null;
  }
}

async function loadPublicImage(cid: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const content = await pigeonApplication.getPublicFile(cid);

      return profilePictureDataUrl(content);
    } catch {
      await new Promise((resolve) =>
        window.setTimeout(resolve, 250 * (attempt + 1)),
      );
    }
  }

  return null;
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

function memberDisplayName(
  identity: IdentityResource | undefined,
  identityId: string,
): string {
  return identity
    ? (identityName(identity) ?? shortId(identity.id))
    : shortId(identityId);
}

function memberPrimaryName(
  identity: IdentityResource | undefined,
  identityId: string,
): string {
  const name = identity?.profile.name.trim();

  if (name) return name;

  const handle = identity?.profile.handle?.trim();

  return handle ? `@${handle}` : shortId(identityId);
}

type CommunityChannelPlainPayload = {
  attachments?: MessageAttachment[];
  authorIdentityId?: string;
  channelId?: string;
  communityId?: string;
  content?: string;
  timestamp?: number;
  type?: string;
};

type CommunityChannelEnvelope = {
  algorithm: 'community-channel.v1';
  ciphertext: string;
  iv: string;
  recipients: Record<string, string>;
};

async function encryptCommunityChannelPayload(input: {
  attachments: MessageAttachment[];
  authorIdentityId: string;
  channelId: string;
  communityKey?: ConversationKeyEntry;
  communityId: string;
  content: string;
  recipients: IdentityResource[];
  timestamp: number;
}): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { length: 256, name: 'AES-GCM' },
    true,
    ['decrypt', 'encrypt'],
  );
  const rawKey = await crypto.subtle.exportKey('raw', key);
  const rawKeyBase64 = bytesToBase64(new Uint8Array(rawKey));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(
    JSON.stringify({
      attachments: input.attachments,
      authorIdentityId: input.authorIdentityId,
      channelId: input.channelId,
      communityId: input.communityId,
      content: input.content,
      timestamp: input.timestamp,
      type: 'CommunityChannelMessageSent',
    }),
  );
  const encrypted = await crypto.subtle.encrypt(
    { iv, name: 'AES-GCM' },
    key,
    plaintext,
  );
  const recipients: Record<string, string> = {};

  if (input.communityKey) {
    recipients[input.communityId] = PublicKey.fromPEM(
      input.communityKey.publicKey,
    )
      .encrypt(rawKeyBase64)
      .toString();
  }

  for (const identity of input.recipients) {
    recipients[identity.id] = PublicKey.fromPEM(
      identity.encryptedKeyPair.publicKey,
    )
      .encrypt(rawKeyBase64)
      .toString();
  }

  return JSON.stringify({
    algorithm: 'community-channel.v1',
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    recipients,
  } satisfies CommunityChannelEnvelope);
}

async function decryptCommunityChannelPayload(
  session: Session,
  encryptedPayload: string,
): Promise<CommunityChannelPlainPayload> {
  const envelope = JSON.parse(encryptedPayload) as CommunityChannelEnvelope;
  const wrappedKey =
    envelope.recipients[session.identity.id] ??
    envelope.recipients[normalizeIdentityId(session.identity.id)];

  if (!wrappedKey) {
    const communityRecipient = Object.values(session.keychain.conversations)
      .map((keyEntry) => ({
        keyEntry,
        wrappedKey: envelope.recipients[keyEntry.conversationId],
      }))
      .find((entry) => entry.wrappedKey);

    if (!communityRecipient?.wrappedKey) {
      throw new Error(copy.messages.missingKey);
    }

    const rawCommunityKey = await PrivateKey.fromPEM(
      communityRecipient.keyEntry.privateKey,
    ).decrypt(new EncryptedPayload(communityRecipient.wrappedKey));

    return await decryptCommunityEnvelope(
      envelope,
      new TextDecoder().decode(rawCommunityKey),
    );
  }

  const rawKey = await session.encryptedKeyPair.decrypt(
    new EncryptedPayload(wrappedKey),
    session.password,
  );

  return await decryptCommunityEnvelope(envelope, rawKey.toString());
}

async function decryptCommunityEnvelope(
  envelope: CommunityChannelEnvelope,
  rawKeyBase64: string,
): Promise<CommunityChannelPlainPayload> {
  const key = await crypto.subtle.importKey(
    'raw',
    bytesToArrayBuffer(base64ToBytes(rawKeyBase64)),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const decrypted = await crypto.subtle.decrypt(
    { iv: bytesToArrayBuffer(base64ToBytes(envelope.iv)), name: 'AES-GCM' },
    key,
    bytesToArrayBuffer(base64ToBytes(envelope.ciphertext)),
  );

  return JSON.parse(
    new TextDecoder().decode(decrypted),
  ) as CommunityChannelPlainPayload;
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
  key: string,
): string | undefined {
  const value = event.attributes[key];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function realtimeMessageAttribute(
  event: RealtimeDomainEvent,
): MessageResource | null {
  const value = event.attributes.message;

  return value && typeof value === 'object' ? (value as MessageResource) : null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copyBytes = new Uint8Array(bytes.byteLength);

  copyBytes.set(bytes);

  return copyBytes.buffer;
}
