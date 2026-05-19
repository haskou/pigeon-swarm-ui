import type { FormEvent, MouseEvent } from 'react';

import { EncryptedPayload, PrivateKey, PublicKey } from '@haskou/value-objects';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { CallParticipant } from '../../domain/calls/CallSession';
import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  ChatMessage,
  ConversationKeyEntry,
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  MessageAttachment,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { shortId } from '../../utils/formatting';
import {
  identityDisplayName,
  type IdentityNames,
  type IdentityPictures,
} from '../../utils/identityDisplay';
import { Composer } from '../chat/Composer';
import { memberPrimaryName } from '../community/communityMemberNames';
import { useDesktopInputFocus } from '../common/useDesktopInputFocus';
import { UserProfileDialog } from '../profile/UserProfileDialog';
import { ChatEmptyState } from './ChatEmptyState';
import { ChatConversationHeader } from './ChatConversationHeader';
import { ChatMessageTimeline } from './ChatMessageTimeline';
import { ChatTypingIndicator } from './ChatTypingIndicator';
import { ConversationDataDialog } from './ConversationDataDialog';
import { ConversationActionsMenu } from './ConversationActionsMenu';
import { ConversationKeyDialog } from './ConversationKeyDialog';
import { GroupProfileDialog } from './GroupProfileDialog';
import { GroupInvitationDialog } from './GroupInvitationDialog';

type LoadState = 'idle' | 'loading' | 'error';

type ProfilePopoverAnchor = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

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
  hasConversationKey: boolean;
  hasReachedMessageStart: boolean;
  messages: ChatMessage[];
  messageState: LoadState;
  nodeNetworks: NodeNetwork[];
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
  onConversationKeyImported: (keyEntry: ConversationKeyEntry) => Promise<void>;
  onDraftChange: (value: string) => void;
  onEscape: () => void;
  onJumpToLatest: () => void;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onReactionToggle: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onReplyReferenceClick: (messageId: string) => void;
  onRetryMessage: (message: ChatMessage) => void;
  onOpenSidebar: () => void;
  onCreate: () => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
  ) => Promise<void>;
  onRealtimeEventsOpen?: () => void;
  progress?: AttachmentProgress | null;
  realtimeStatus?: 'connected' | 'reconnecting';
  replyToMessage?: ChatMessage | null;
  onCancelReply: () => void;
  onStartCall?: (input: {
    conversationId: string;
    kind: 'group' | 'one-to-one';
    participants: CallParticipant[];
    title: string;
  }) => void;
  onTypingActive?: (active: boolean) => void;
  typingIdentityIds?: string[];
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

function normalizeIdentityLookup(value: string): string {
  const trimmed = value.trim();

  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}

export function ChatColumn({
  activeConversation,
  bottomRef,
  conversationKey,
  draft,
  hasConversationKey,
  hasReachedMessageStart,
  identityNames,
  identityPictures,
  identityProfiles,
  presenceByIdentityId = {},
  messages,
  messageState,
  newMessageCount,
  nodeNetworks,
  onCancelReply,
  onConversationKeyImported,
  onCreate,
  onDraftChange,
  onEscape,
  onJumpToLatest,
  onMessageMenuOpen,
  onOpenConversationWithIdentity,
  onOpenSidebar,
  onReactionToggle,
  onRealtimeEventsOpen,
  onReplyReferenceClick,
  onRetryMessage,
  onScroll,
  onSend,
  onStartCall,
  onTypingActive,
  peerIdentity,
  peerIdentityId,
  peerPicture,
  progress,
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
  const [downloadProgress, setDownloadProgress] =
    useState<AttachmentProgress | null>(null);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [conversationDataOpen, setConversationDataOpen] = useState(false);
  const [groupInviteOpen, setGroupInviteOpen] = useState(false);
  const [groupInviteInput, setGroupInviteInput] = useState('');
  const [groupInviteError, setGroupInviteError] = useState<string | null>(null);
  const [groupInviteLoading, setGroupInviteLoading] = useState(false);
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

      if (!parsed.privateKey) {
        throw new Error('Conversation key payload is missing the private key.');
      }

      const privateKey = PrivateKey.fromPEM(parsed.privateKey);
      const publicKey =
        parsed.publicKey ?? privateKey.getPublicKey().toString();
      const keyEntry: ConversationKeyEntry = {
        conversationId: activeConversation.id,
        createdAt: parsed.createdAt ?? Date.now(),
        peerIdentityId:
          parsed.peerIdentityId ?? peerIdentityId ?? session.identity.id,
        privateKey: privateKey.toString(),
        publicKey,
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
      await pigeonApplication.createGroupConversationInvitation(
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

    setAttachmentError(null);
    setDownloadProgress(null);
    try {
      const url = await loadAttachmentPreview(
        attachment,
        setDownloadProgress,
      );
      const link = document.createElement('a');

      setAttachmentError(null);
      setDownloadProgress(null);
      link.href = url;
      link.download = attachment.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setDownloadProgress(null);
      setAttachmentError(copy.composer.attachmentDownloadError);
    }
  };
  return (
    <section className="glass-panel-strong flex min-h-0 flex-col overflow-hidden rounded-none">
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
            messages={messages}
            newMessageCount={newMessageCount}
            onAttachmentOpen={(attachment) => void openAttachment(attachment)}
            onAuthorProfileOpen={(message, target) =>
              openMessageAuthorProfile(message, profileAnchorFromTarget(target))
            }
            onJumpToLatest={onJumpToLatest}
            onMessageMenuOpen={onMessageMenuOpen}
            onReactionToggle={onReactionToggle}
            onReplyReferenceClick={onReplyReferenceClick}
            onRetryMessage={onRetryMessage}
            onScroll={onScroll}
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
            error={sendError ?? attachmentError}
            focusKey={activeConversation.id}
            onDraftChange={handleDraftChange}
            onEscape={onEscape}
            onSend={handleSend}
            onCancelReply={onCancelReply}
            progress={downloadProgress ?? progress}
            placeholder={
              hasConversationKey
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
          />
        </>
      )}
      {conversationDataOpen && (
        <ConversationDataDialog
          data={conversationData}
          onClose={() => setConversationDataOpen(false)}
        />
      )}
      {groupInviteOpen && activeConversation && (
        <GroupInvitationDialog
          autoFocus={canAutoFocusInput}
          error={groupInviteError}
          input={groupInviteInput}
          loading={groupInviteLoading}
          onClose={() => setGroupInviteOpen(false)}
          onInputChange={setGroupInviteInput}
          onSubmit={(event) => void sendGroupInvitation(event)}
        />
      )}
      {conversationKeyDialog && (
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
      )}
      {profileViewer && (
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
      )}
      {groupProfileOpen && activeConversation && (
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
