import type { FormEvent, MouseEvent } from 'react';

import { EncryptedPayload, PublicKey, SymmetricKey } from '@haskou/value-objects';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import type { NodeNetwork } from '../../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import type { CallParticipant } from '../../../../contexts/calls/domain/callSession.types';
import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  ChatMessage,
  ConversationKeyEntry,
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  ConversationInvitationNotificationResource,
  NotificationScopeSetting,
  PollResource,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

import { applicationContainer } from '../../../composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { shortId } from '../../../../shared/presentation/formatting';
import {
  identityDisplayName,
  type IdentityNames,
  type IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { Composer } from '../../../../contexts/messages/presentation/components/Composer';
import { useAttachmentDownload } from '../../../../contexts/attachments/presentation/hooks/useAttachmentDownload';
import { memberPrimaryName } from '../../../../contexts/communities/presentation/components/communityMemberNames';
import { useDesktopInputFocus } from '../../../../shared/presentation/components/useDesktopInputFocus';
import { InvitationKeyPrompt } from '../../../../contexts/notifications/presentation/components/InvitationKeyPrompt';
import {
  profileAnchorFromTarget,
  type ProfilePopoverAnchor,
} from '../../../../contexts/identities/presentation/view-models/profilePopoverAnchor';
import { ChatEmptyState } from './ChatEmptyState';
import { ChatConversationHeader } from './ChatConversationHeader';
import { ChatMessageTimeline } from './ChatMessageTimeline';
import { ChatTypingIndicator } from './ChatTypingIndicator';
import { ConversationActionsMenu } from './ConversationActionsMenu';

const ConversationDataDialog = lazy(() =>
  import('./ConversationDataDialog').then((module) => ({
    default: module.ConversationDataDialog,
  })),
);
const ConversationKeyDialog = lazy(() =>
  import('./ConversationKeyDialog').then((module) => ({
    default: module.ConversationKeyDialog,
  })),
);
const CreatePollDialog = lazy(() =>
  import('../../../../contexts/polls/presentation/components/CreatePollDialog').then(
    (module) => ({
      default: module.CreatePollDialog,
    }),
  ),
);
const GroupInvitationDialog = lazy(() =>
  import('./GroupInvitationDialog').then((module) => ({
    default: module.GroupInvitationDialog,
  })),
);
const GroupProfileDialog = lazy(() =>
  import('./GroupProfileDialog').then((module) => ({
    default: module.GroupProfileDialog,
  })),
);
const StickerPackPreviewDialog = lazy(() =>
  import('../../../../contexts/stickers/presentation/components/StickerPackPreviewDialog').then(
    (module) => ({
      default: module.StickerPackPreviewDialog,
    }),
  ),
);
const UserProfileDialog = lazy(() =>
  import('../../../../contexts/identities/presentation/components/UserProfileDialog').then(
    (module) => ({
      default: module.UserProfileDialog,
    }),
  ),
);

type LoadState = 'idle' | 'loading' | 'error';

interface ChatColumnProps {
  session: Session;
  activeConversation?: ConversationResource;
  peerIdentityId?: string;
  peerIdentity?: IdentityResource;
  peerPicture?: string;
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
  presenceByIdentityId?: Record<string, IdentityPresence>;
  conversationKey?: ConversationKeyEntry;
  draft: string;
  editingMessage?: ChatMessage | null;
  hasConversationKey: boolean;
  hasReachedMessageStart: boolean;
  invitationAccepting?: boolean;
  invitationError?: null | string;
  invitationInviterName?: string;
  messages: ChatMessage[];
  messageState: LoadState;
  nodeNetworks: NodeNetwork[];
  pinnedMessageIds: ReadonlySet<string>;
  sendError: string | null;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  newMessageCount: number;
  onScroll: () => void;
  onSend: (
    content: string,
    attachments: File[],
    options: AttachmentUploadOptions,
  ) => Promise<void>;
  onEditMessage: (content: string) => Promise<void>;
  onStickerSend: (sticker: StickerMessageReference) => Promise<void>;
  onConversationKeyImported: (keyEntry: ConversationKeyEntry) => Promise<void>;
  onInvitationAccept?: (
    notification: ConversationInvitationNotificationResource,
  ) => void;
  onDraftChange: (value: string) => void;
  onEscape: () => void;
  onJumpToLatest: () => void;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onOpenMessageThread: (message: ChatMessage) => void;
  onReactionToggle: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onReplyReferenceClick: (messageId: string) => void;
  onRetryMessage: (message: ChatMessage) => void;
  onOpenSidebar: () => void;
  onOpenPins: () => void;
  groupInviteRequest?: number;
  notificationSetting: NotificationScopeSetting;
  onCreate: () => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
  ) => Promise<void>;
  onNotificationSettingsOpen: (input: {
    scope: NotificationScopeSetting['scope'];
    subtitle?: string;
    title: string;
  }) => void;
  onNotificationMuteToggle: (scope: NotificationScopeSetting['scope']) => void;
  onRealtimeEventsOpen?: () => void;
  progress?: AttachmentProgress | null;
  realtimeStatus?: 'connected' | 'reconnecting';
  onCancelEdit: () => void;
  replyToMessage?: ChatMessage | null;
  onCancelReply: () => void;
  onStartCall?: (input: {
    conversationId: string;
    kind: 'group' | 'one-to-one';
    participants: CallParticipant[];
    title: string;
  }) => void;
  onTypingActive?: (active: boolean) => void;
  pendingInvitation?: ConversationInvitationNotificationResource | null;
  realtimeEvent?: RealtimeDomainEvent | null;
  typingIdentityIds?: string[];
}

function normalizeIdentityLookup(value: string): string {
  const trimmed = value.trim();

  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}

export function ChatColumn({
  activeConversation,
  bottomRef,
  conversationKey,
  draft,
  editingMessage,
  hasConversationKey,
  hasReachedMessageStart,
  groupInviteRequest = 0,
  identityNames,
  identityPictures,
  identityProfiles,
  invitationAccepting = false,
  invitationError,
  invitationInviterName,
  presenceByIdentityId = {},
  messages,
  messageState,
  newMessageCount,
  nodeNetworks,
  notificationSetting,
  onCancelReply,
  onCancelEdit,
  onConversationKeyImported,
  onInvitationAccept,
  onCreate,
  onDraftChange,
  onEscape,
  onJumpToLatest,
  onMessageMenuOpen,
  onOpenMessageThread,
  onOpenConversationWithIdentity,
  onOpenPins,
  onOpenSidebar,
  onReactionToggle,
  onNotificationSettingsOpen,
  onNotificationMuteToggle,
  onRealtimeEventsOpen,
  onReplyReferenceClick,
  onRetryMessage,
  onScroll,
  onSend,
  onEditMessage,
  onStickerSend,
  onStartCall,
  onTypingActive,
  peerIdentity,
  peerIdentityId,
  peerPicture,
  pendingInvitation,
  pinnedMessageIds,
  progress,
  realtimeEvent,
  realtimeStatus = 'connected',
  replyToMessage,
  scrollerRef,
  sendError,
  session,
  typingIdentityIds = [],
}: ChatColumnProps) {
  const [profileViewer, setProfileViewer] = useState<{
    anchor?: ProfilePopoverAnchor;
    identity?: IdentityResource;
    identityId: string;
    name: string;
    picture?: string | null;
  } | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [stickerPackPreview, setStickerPackPreview] =
    useState<StickerMessageReference | null>(null);
  const [downloadProgress, setDownloadProgress] =
    useState<AttachmentProgress | null>(null);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [conversationDataOpen, setConversationDataOpen] = useState(false);
  const [groupInviteOpen, setGroupInviteOpen] = useState(false);
  const [groupInviteInput, setGroupInviteInput] = useState('');
  const [groupInviteError, setGroupInviteError] = useState<string | null>(null);
  const [groupInviteLoading, setGroupInviteLoading] = useState(false);
  const [polls, setPolls] = useState<PollResource[]>([]);
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const reactionAuthorNames = useMemo(
    () => ({
      ...identityNames,
      [session.identity.id]:
        session.identity.profile.name.trim() ||
        identityNames[session.identity.id] ||
        session.identity.id,
    }),
    [identityNames, session.identity.id, session.identity.profile.name],
  );
  const [groupProfileOpen, setGroupProfileOpen] = useState(false);
  const [conversationKeyDialog, setConversationKeyDialog] = useState<
    'add' | 'copy' | null
  >(null);
  const [encryptedConversationKey, setEncryptedConversationKey] = useState('');
  const [conversationKeyInput, setConversationKeyInput] = useState('');
  const [conversationKeyError, setConversationKeyError] = useState<
    string | null
  >(null);
  const [conversationKeySaving, setConversationKeySaving] = useState(false);
  const canAutoFocusInput = useDesktopInputFocus();
  const handleDraftChange = (value: string) => {
    onDraftChange(value);
    onTypingActive?.(value.trim().length > 0);
  };
  const handleSend = async (
    content: string,
    attachments: File[],
    options: AttachmentUploadOptions,
  ) => {
    onTypingActive?.(false);
    await onSend(content, attachments, options);
  };
  const handleEditMessage = async (content: string) => {
    onTypingActive?.(false);
    await onEditMessage(content);
  };
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
  const handleCreatePoll = async (input: {
    allowsMultipleVotes: boolean;
    options: { id: string; text: string }[];
    question: string;
  }) => {
    if (!activeConversation) return;

    const poll = await applicationContainer.createPoll(session, {
      allowsMultipleVotes: input.allowsMultipleVotes,
      conversationId: activeConversation.id,
      options: input.options,
      question: input.question,
      scopeType: 'group_conversation',
    });

    upsertPoll(poll);
  };
  const votePoll = async (poll: PollResource, optionIds: string[]) => {
    upsertPoll(
      await applicationContainer.votePoll(session, poll.id, optionIds),
    );
  };
  const removePollVote = async (poll: PollResource) => {
    upsertPoll(await applicationContainer.removePollVote(session, poll.id));
  };
  const closePoll = async (poll: PollResource) => {
    upsertPoll(await applicationContainer.closePoll(session, poll.id));
  };

  useEffect(() => {
    if (!realtimeEvent?.type.startsWith('polls.v1.')) return;

    const poll = realtimeEvent.attributes.poll as PollResource | undefined;
    const pollId =
      typeof realtimeEvent.attributes.pollId === 'string'
        ? realtimeEvent.attributes.pollId
        : undefined;

    if (poll?.scope.type === 'group_conversation') {
      upsertPoll(poll);

      return;
    }

    if (!pollId) return;

    void applicationContainer
      .getPoll(session, pollId)
      .then((loadedPoll) => {
        if (loadedPoll.scope.type === 'group_conversation') {
          upsertPoll(loadedPoll);
        }
      })
      .catch(() => undefined);
  }, [realtimeEvent, session, upsertPoll]);

  useEffect(
    () => () => {
      onTypingActive?.(false);
    },
    [activeConversation?.id, onTypingActive],
  );
  const isGroupConversation = !!(
    activeConversation &&
    (activeConversation.type === 'group' ||
      activeConversation.id.startsWith('group:'))
  );
  useEffect(() => {
    if (!groupInviteRequest || !isGroupConversation) return;

    setGroupInviteError(null);
    setGroupInviteOpen(true);
  }, [groupInviteRequest, isGroupConversation]);
  const activeConversationPolls = useMemo(
    () =>
      activeConversation
        ? polls.filter(
            (poll) =>
              poll.scope.type === 'group_conversation' &&
              poll.scope.conversationId === activeConversation.id,
          )
        : [],
    [activeConversation, polls],
  );
  const canCreatePoll =
    isGroupConversation &&
    !!activeConversation &&
    conversationParticipantIds(activeConversation).includes(
      session.identity.id,
    );
  const activeConversationName = isGroupConversation
    ? (activeConversation?.name ?? activeConversation?.title)
    : peerIdentityId
      ? identityDisplayName(peerIdentityId, identityNames)
      : activeConversation?.title;
  const activeConversationFallbackName = activeConversationName?.replace(
    /\s+\(@[^)]+\)$/,
    '',
  );
  const activeConversationTitle = isGroupConversation
    ? activeConversationName
    : peerIdentity?.profile.name.trim() ||
      (peerIdentity?.profile.handle?.trim()
        ? `@${peerIdentity.profile.handle.trim()}`
        : activeConversationFallbackName);
  const conversationNetworkId = activeConversation?.networkId;
  const conversationNetworkName = conversationNetworkId
    ? (nodeNetworks.find((network) => network.id === conversationNetworkId)
        ?.name ?? shortId(conversationNetworkId))
    : copy.profile.noNetworks;
  const conversationNetworkTooltip =
    conversationNetworkId ?? copy.profile.noNetworks;
  const conversationData = useMemo(
    () => ({
      frontendDerived: {
        conversationNetworkId: conversationNetworkId ?? null,
        conversationNetworkName,
        e2eReady: hasConversationKey,
        loadedMessages: messages.length,
        peerIdentity,
        peerIdentityId: peerIdentityId ?? null,
      },
      serverConversation: activeConversation ?? null,
    }),
    [
      activeConversation,
      conversationNetworkId,
      conversationNetworkName,
      hasConversationKey,
      messages.length,
      peerIdentity,
      peerIdentityId,
    ],
  );
  const canOpenPeerProfile =
    !!activeConversation && !!peerIdentityId && !isGroupConversation;
  const groupParticipants = useMemo(
    () =>
      conversationParticipantIds(activeConversation).map((identityId) => {
        const identity = identityProfiles[identityId];

        return {
          identity,
          identityId,
          name: memberPrimaryName(identity, identityId),
          picture: identityPictures[identityId],
        };
      }),
    [activeConversation, identityNames, identityPictures, identityProfiles],
  );
  const callParticipants = useMemo(
    () =>
      groupParticipants.map((participant) => ({
        identity: participant.identity,
        identityId: participant.identityId,
        muted: false,
        name: participant.name,
        picture: participant.picture,
      })),
    [groupParticipants],
  );
  const canShareConversationKey = !isGroupConversation;
  const hasPendingInvitation =
    !hasConversationKey && !!pendingInvitation && !!onInvitationAccept;
  const invitationPrompt =
    !hasConversationKey && pendingInvitation && onInvitationAccept ? (
    <InvitationKeyPrompt
      accepting={invitationAccepting}
      error={invitationError}
      inviterName={invitationInviterName}
      kind="conversation"
      onAccept={() => onInvitationAccept(pendingInvitation)}
      onManualImport={() => {
        setConversationKeyError(null);
        setConversationKeyDialog('add');
      }}
    />
  ) : null;
  const closeConversationKeyDialog = () => {
    setConversationKeyDialog(null);
    setEncryptedConversationKey('');
    setConversationKeyInput('');
    setConversationKeyError(null);
    setConversationKeySaving(false);
  };
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      setProfileViewer(null);
      setGroupProfileOpen(false);
      setConversationMenuOpen(false);
      setConversationDataOpen(false);
      setGroupInviteOpen(false);
      closeConversationKeyDialog();
    };

    window.addEventListener('keydown', handleEscape);

    return () => window.removeEventListener('keydown', handleEscape);
  }, []);
  const openCopyConversationKeyDialog = () => {
    if (!activeConversation || !conversationKey || !peerIdentity) {
      setConversationKeyError(copy.chat.copyPrivateKeyUnavailable);
      setConversationKeyDialog('copy');

      return;
    }

    try {
      const recipientKeyEntry: ConversationKeyEntry = {
        ...conversationKey,
        conversationId: activeConversation.id,
        peerIdentityId: session.identity.id,
      };
      const encrypted = PublicKey.fromPEM(
        peerIdentity.encryptedKeyPair.publicKey,
      )
        .encrypt(JSON.stringify(recipientKeyEntry))
        .toString();

      setEncryptedConversationKey(encrypted);
      setConversationKeyError(null);
    } catch {
      setConversationKeyError(copy.chat.copyPrivateKeyError);
    }
    setConversationKeyDialog('copy');
  };
  const importConversationKey = async () => {
    if (!activeConversation) return;

    const encryptedPayload = conversationKeyInput.trim();

    if (!encryptedPayload) {
      setConversationKeyError(copy.chat.addPrivateKeyRequired);

      return;
    }

    setConversationKeySaving(true);
    setConversationKeyError(null);
    try {
      const decrypted = await session.encryptedKeyPair.decrypt(
        new EncryptedPayload(encryptedPayload),
        session.password,
      );
      const parsed = JSON.parse(
        decrypted.toString(),
      ) as Partial<ConversationKeyEntry>;

      if (parsed.conversationId !== activeConversation.id) {
        throw new Error('Conversation key belongs to another conversation.');
      }

      if (
        parsed.algorithm !== 'aes-256-gcm' ||
        !parsed.key ||
        parsed.version !== 2
      ) {
        throw new Error('Conversation key payload is invalid.');
      }

      SymmetricKey.fromBase64(parsed.key);
      const keyEntry: ConversationKeyEntry = {
        algorithm: 'aes-256-gcm',
        conversationId: activeConversation.id,
        createdAt: parsed.createdAt ?? Date.now(),
        key: parsed.key,
        kind: parsed.kind ?? 'conversation',
        peerIdentityId:
          parsed.peerIdentityId ?? peerIdentityId ?? session.identity.id,
        version: 2,
      };

      await onConversationKeyImported(keyEntry);
      closeConversationKeyDialog();
    } catch {
      setConversationKeyError(copy.chat.addPrivateKeyError);
    } finally {
      setConversationKeySaving(false);
    }
  };
  const sendGroupInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeConversation || groupInviteLoading) return;

    const recipientIdentityId = normalizeIdentityLookup(groupInviteInput);

    if (!recipientIdentityId) return;

    setGroupInviteLoading(true);
    setGroupInviteError(null);
    try {
      await applicationContainer.createGroupConversationInvitation(
        session,
        activeConversation.id,
        recipientIdentityId,
      );
      setGroupInviteInput('');
      setGroupInviteOpen(false);
    } catch (caught) {
      setGroupInviteError(
        caught instanceof Error ? caught.message : copy.chat.inviteError,
      );
    } finally {
      setGroupInviteLoading(false);
    }
  };
  const openOwnProfile = (anchor?: ProfilePopoverAnchor) =>
    setProfileViewer({
      anchor,
      identity: session.identity,
      identityId: session.identity.id,
      name: session.identity.profile.name,
      picture: identityPictures[session.identity.id],
    });
  const openPeerProfile = (anchor?: ProfilePopoverAnchor) => {
    if (!peerIdentityId || !activeConversationName) return;

    setProfileViewer({
      anchor,
      identity: peerIdentity,
      identityId: peerIdentityId,
      name: activeConversationName,
      picture: peerPicture,
    });
  };
  const openConversationHeader = (event?: MouseEvent<HTMLElement>) => {
    if (!activeConversation) return;

    if (isGroupConversation) {
      setGroupProfileOpen(true);

      return;
    }

    openPeerProfile(profileAnchorFromTarget(event?.currentTarget));
  };
  const openMessageAuthorProfile = (
    message: ChatMessage,
    anchor?: ProfilePopoverAnchor,
  ) => {
    if (message.mine || message.authorIdentityId === session.identity.id) {
      openOwnProfile(anchor);

      return;
    }

    setProfileViewer({
      anchor,
      identity: identityProfiles[message.authorIdentityId],
      identityId: message.authorIdentityId,
      name: identityDisplayName(message.authorIdentityId, identityNames),
      picture: identityPictures[message.authorIdentityId],
    });
  };
  const { loadAttachmentPreview, openAttachment } = useAttachmentDownload({
    errorMessage: copy.composer.attachmentDownloadError,
    onErrorChange: setAttachmentError,
    onProgressChange: setDownloadProgress,
  });
  return (
    <section className="app-safe-area-panel glass-panel-strong flex min-h-0 flex-col overflow-hidden rounded-none">
      <ChatConversationHeader
        activeConversation={activeConversation}
        activeConversationName={activeConversationName}
        activeConversationTitle={activeConversationTitle}
        canOpenPeerProfile={canOpenPeerProfile}
        conversationNetworkName={conversationNetworkName}
        conversationNetworkTooltip={conversationNetworkTooltip}
        hasConversationKey={hasConversationKey}
        isGroupConversation={isGroupConversation}
        menuOpen={conversationMenuOpen}
        onConversationOpen={openConversationHeader}
        onMenuToggle={() => setConversationMenuOpen((isOpen) => !isOpen)}
        onOpenSidebar={onOpenSidebar}
        onPinsOpen={onOpenPins}
        onRealtimeEventsOpen={onRealtimeEventsOpen}
        peerPicture={peerPicture}
        peerPresence={
          peerIdentityId ? presenceByIdentityId[peerIdentityId] : undefined
        }
        realtimeStatus={realtimeStatus}
      >
        {conversationMenuOpen && activeConversation && (
          <ConversationActionsMenu
            activeConversation={activeConversation}
            activeConversationName={activeConversationName}
            activeConversationTitle={activeConversationTitle}
            callParticipants={callParticipants}
            canShareConversationKey={canShareConversationKey}
            hasConversationKey={hasConversationKey}
            isGroupConversation={isGroupConversation}
            notificationSetting={notificationSetting}
            onClose={() => setConversationMenuOpen(false)}
            onConversationDataOpen={() => setConversationDataOpen(true)}
            onConversationKeyOpen={() => {
              if (hasConversationKey) {
                openCopyConversationKeyDialog();
              } else {
                setConversationKeyError(null);
                setConversationKeyDialog('add');
              }
            }}
            onGroupInviteOpen={() => {
              setGroupInviteError(null);
              setGroupInviteOpen(true);
            }}
            onNotificationMuteToggle={() =>
              onNotificationMuteToggle(notificationSetting.scope)
            }
            onNotificationSettingsOpen={() =>
              onNotificationSettingsOpen({
                scope: notificationSetting.scope,
                subtitle: conversationNetworkName,
                title: activeConversationTitle ?? activeConversation.id,
              })
            }
            onOpenPins={onOpenPins}
            onRealtimeEventsOpen={onRealtimeEventsOpen}
            onStartCall={onStartCall}
          />
        )}
      </ChatConversationHeader>

      {!activeConversation ? (
        <ChatEmptyState onCreate={onCreate} />
      ) : (
        <>
          <ChatMessageTimeline
            bottomRef={bottomRef}
            currentIdentityId={session.identity.id}
            currentIdentityName={session.identity.profile.name}
            hasConversationKey={hasConversationKey}
            hasReachedMessageStart={hasReachedMessageStart}
            identityNames={identityNames}
            identityPictures={identityPictures}
            isGroupConversation={isGroupConversation}
            loadAttachmentPreview={loadAttachmentPreview}
            messageState={messageState}
            missingConversationKeyContent={invitationPrompt}
            messages={messages}
            newMessageCount={newMessageCount}
            onAttachmentOpen={(attachment) => void openAttachment(attachment)}
            onAuthorProfileOpen={(message, target) =>
              openMessageAuthorProfile(message, profileAnchorFromTarget(target))
            }
            onJumpToLatest={onJumpToLatest}
            onMessageMenuOpen={onMessageMenuOpen}
            onOpenThread={onOpenMessageThread}
            onReactionToggle={onReactionToggle}
            onReplyReferenceClick={onReplyReferenceClick}
            onRetryMessage={onRetryMessage}
            onPollClose={closePoll}
            onPollRemoveVote={removePollVote}
            onPollVote={votePoll}
            onStickerClick={handleStickerClick}
            onScroll={onScroll}
            pinnedMessageIds={pinnedMessageIds}
            polls={activeConversationPolls}
            reactionAuthorNames={reactionAuthorNames}
            scrollerRef={scrollerRef}
          />

          {typingIdentityIds.length > 0 && (
            <ChatTypingIndicator
              identityIds={typingIdentityIds}
              identityNames={identityNames}
            />
          )}
          <Composer
            disabled={messageState === 'loading' || !hasConversationKey}
            draft={draft}
            editingMessage={editingMessage}
            error={sendError ?? attachmentError}
            focusKey={`${activeConversation.id}:${editingMessage?.id ?? 'send'}`}
            onCancelEdit={onCancelEdit}
            onDraftChange={handleDraftChange}
            onEdit={handleEditMessage}
            onEscape={onEscape}
            onSend={handleSend}
            onStickerSend={onStickerSend}
            onPollCreate={
              canCreatePoll ? () => setPollDialogOpen(true) : undefined
            }
            onCancelReply={onCancelReply}
            progress={downloadProgress ?? progress}
            placeholder={
              hasConversationKey || hasPendingInvitation
                ? copy.composer.placeholder
                : copy.messages.missingConversationKey
            }
            replyTo={replyToMessage}
            replyToAuthorName={
              replyToMessage
                ? identityDisplayName(
                    replyToMessage.authorIdentityId,
                    identityNames,
                  )
                : undefined
            }
            session={session}
          />
          {stickerPackPreview && (
            <Suspense fallback={null}>
              <StickerPackPreviewDialog
                onClose={() => setStickerPackPreview(null)}
                onStickerSend={onStickerSend}
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
      {conversationDataOpen && (
        <Suspense fallback={null}>
          <ConversationDataDialog
            data={conversationData}
            onClose={() => setConversationDataOpen(false)}
          />
        </Suspense>
      )}
      {groupInviteOpen && activeConversation && (
        <Suspense fallback={null}>
          <GroupInvitationDialog
            autoFocus={canAutoFocusInput}
            error={groupInviteError}
            input={groupInviteInput}
            loading={groupInviteLoading}
            onClose={() => setGroupInviteOpen(false)}
            onInputChange={setGroupInviteInput}
            onSubmit={(event) => void sendGroupInvitation(event)}
          />
        </Suspense>
      )}
      {conversationKeyDialog && (
        <Suspense fallback={null}>
          <ConversationKeyDialog
            encryptedConversationKey={encryptedConversationKey}
            error={conversationKeyError}
            input={conversationKeyInput}
            mode={conversationKeyDialog}
            onClose={closeConversationKeyDialog}
            onCopy={() =>
              void navigator.clipboard.writeText(encryptedConversationKey)
            }
            onImport={() => void importConversationKey()}
            onInputChange={setConversationKeyInput}
            saving={conversationKeySaving}
          />
        </Suspense>
      )}
      {profileViewer && (
        <Suspense fallback={null}>
          <UserProfileDialog
            anchor={profileViewer.anchor}
            identity={profileViewer.identity}
            identityId={profileViewer.identityId}
            name={profileViewer.name}
            nodeNetworks={nodeNetworks}
            onClose={() => setProfileViewer(null)}
            presence={presenceByIdentityId[profileViewer.identityId]}
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
            picture={profileViewer.picture}
          />
        </Suspense>
      )}
      {groupProfileOpen && activeConversation && (
        <Suspense fallback={null}>
          <GroupProfileDialog
            conversation={activeConversation}
            networkId={conversationNetworkId}
            nodeNetworks={nodeNetworks}
            onClose={() => setGroupProfileOpen(false)}
            onIdentityClick={(participant, event) => {
              setGroupProfileOpen(false);
              setProfileViewer({
                anchor: profileAnchorFromTarget(event.currentTarget),
                identity: participant.identity,
                identityId: participant.identityId,
                name: participant.name,
                picture: participant.picture,
              });
            }}
            participants={groupParticipants}
            presenceByIdentityId={presenceByIdentityId}
          />
        </Suspense>
      )}
    </section>
  );
}

function conversationParticipantIds(
  conversation?: ConversationResource,
): string[] {
  if (!conversation) return [];

  return (
    conversation.participantIdentityIds ??
    conversation.participantIds ??
    conversation.participants ??
    []
  );
}
