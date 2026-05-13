import { EncryptedPayload, PrivateKey, PublicKey } from '@haskou/value-objects';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type {
  AttachmentProgress,
  ChatMessage,
  ConversationKeyEntry,
  ConversationResource,
  IdentityResource,
  MessageAttachment,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { isBrowserPreviewImage } from '../../utils/browserPreview';
import { cx } from '../../utils/classNameHelper';
import { shortId } from '../../utils/formatting';
import {
  identityDisplayName,
  type IdentityNames,
  type IdentityPictures,
} from '../../utils/identityDisplay';
import { Composer } from '../chat/Composer';
import { MessageBubble } from '../chat/MessageBubble';
import { UserProfileDialog } from '../profile/UserProfileDialog';
import { ConversationDataDialog } from './ConversationDataDialog';
import { ConversationKeyDialog } from './ConversationKeyDialog';
import { GroupProfileDialog } from './GroupProfileDialog';
import { LockIcon } from './LockIcon';

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
  onSend: (content: string, attachments: File[]) => Promise<void>;
  onConversationKeyImported: (keyEntry: ConversationKeyEntry) => Promise<void>;
  onDraftChange: (value: string) => void;
  onEscape: () => void;
  onJumpToLatest: () => void;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onReplyReferenceClick: (messageId: string) => void;
  onRetryMessage: (message: ChatMessage) => void;
  onOpenSidebar: () => void;
  onCreate: () => void;
  progress?: AttachmentProgress | null;
  realtimeStatus?: 'connected' | 'reconnecting';
  replyToMessage?: ChatMessage | null;
  onCancelReply: () => void;
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
  onOpenSidebar,
  onReplyReferenceClick,
  onRetryMessage,
  onScroll,
  onSend,
  peerIdentity,
  peerIdentityId,
  peerPicture,
  progress,
  realtimeStatus = 'connected',
  replyToMessage,
  scrollerRef,
  sendError,
  session,
}: ChatColumnProps) {
  const [profileViewer, setProfileViewer] = useState<{
    identity?: IdentityResource;
    identityId: string;
    name: string;
    picture?: string | null;
  } | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [conversationDataOpen, setConversationDataOpen] = useState(false);
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
  const e2eTooltip = hasConversationKey
    ? copy.chat.e2eReady
    : copy.chat.e2eMissing;
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
          name: identityDisplayName(identityId, identityNames),
          picture: identityPictures[identityId],
        };
      }),
    [activeConversation, identityNames, identityPictures, identityProfiles],
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
  const openOwnProfile = () =>
    setProfileViewer({
      identity: session.identity,
      identityId: session.identity.id,
      name: session.identity.profile.name,
      picture: identityPictures[session.identity.id],
    });
  const openPeerProfile = () => {
    if (!peerIdentityId || !activeConversationName) return;

    setProfileViewer({
      identity: peerIdentity,
      identityId: peerIdentityId,
      name: activeConversationName,
      picture: peerPicture,
    });
  };
  const openConversationHeader = () => {
    if (!activeConversation) return;

    if (isGroupConversation) {
      setGroupProfileOpen(true);
      return;
    }

    openPeerProfile();
  };
  const openMessageAuthorProfile = (message: ChatMessage) => {
    if (message.mine || message.authorIdentityId === session.identity.id) {
      openOwnProfile();

      return;
    }

    setProfileViewer({
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
    try {
      const url = await loadAttachmentPreview(
        attachment,
        setAttachmentErrorProgress,
      );
      const link = document.createElement('a');

      setAttachmentError(null);
      link.href = url;
      link.download = attachment.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setAttachmentError(copy.composer.attachmentDownloadError);
    }
  };
  const setAttachmentErrorProgress = (nextProgress: AttachmentProgress) => {
    setAttachmentError(
      `${copy.composer.decryptingAttachment} ${nextProgress.filename} ${nextProgress.percent}%`,
    );
  };

  return (
    <section className="glass-panel-strong flex min-h-0 flex-col overflow-hidden rounded-none sm:rounded-[2rem]">
      <header className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            aria-label={copy.chat.menu}
            className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 font-black lg:hidden"
          >
            ☰
          </button>
          <button
            type="button"
            onClick={openConversationHeader}
            disabled={!activeConversation || (!isGroupConversation && !canOpenPeerProfile)}
            className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950 disabled:cursor-default"
            aria-label={activeConversationName ?? copy.chat.noConversation}
          >
            {peerPicture ? (
              <img
                src={peerPicture}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : activeConversation ? (
              (activeConversationName ?? activeConversation.id)
                .slice(0, 1)
                .toUpperCase()
            ) : (
              '∅'
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={openConversationHeader}
                disabled={!activeConversation || (!isGroupConversation && !canOpenPeerProfile)}
                className="min-w-0 truncate text-left text-2xl font-black tracking-tight disabled:cursor-default"
              >
                {activeConversation
                  ? (activeConversationTitle ?? activeConversation.id)
                  : copy.chat.noConversation}
              </button>
              {activeConversation ? (
                <span
                  className={
                    hasConversationKey
                      ? 'shrink-0 text-emerald-300'
                      : 'shrink-0 text-rose-300'
                  }
                  title={e2eTooltip}
                  aria-label={e2eTooltip}
                >
                  <LockIcon locked={hasConversationKey} />
                </span>
              ) : null}
            </div>
            {activeConversation ? (
              <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-white/50">
                {isGroupConversation ? (
                  <span className="shrink-0">{copy.chat.groupMessage}</span>
                ) : (
                  <span className="shrink-0">{copy.chat.directMessage}</span>
                )}
                <span className="text-white/25">·</span>
                <span
                  className="min-w-0 truncate"
                  title={conversationNetworkTooltip}
                >
                  {conversationNetworkName}
                </span>
              </div>
            ) : (
              <div className="truncate text-sm text-white/50">
                {copy.chat.noConversationHint}
              </div>
            )}
          </div>
          <div
            className={cx(
              'hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black sm:flex',
              realtimeStatus === 'connected'
                ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200'
                : 'border-amber-300/20 bg-amber-400/10 text-amber-100',
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
          </div>
          {activeConversation ? (
            <div className="relative ml-auto shrink-0">
              <button
                type="button"
                onClick={() => setConversationMenuOpen((isOpen) => !isOpen)}
                className="grid h-11 w-11 place-items-center rounded-2xl text-xl font-black text-white/70 transition hover:bg-white/15"
                aria-label={copy.chat.conversationMenu}
                aria-expanded={conversationMenuOpen}
              >
                ⋮
              </button>
              {conversationMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-30 cursor-default"
                    onClick={() => setConversationMenuOpen(false)}
                    aria-label={copy.dialog.close}
                  />
                  <div className="absolute right-0 top-[calc(100%+.5rem)] z-40 min-w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#15172d] p-1 text-sm shadow-2xl shadow-black/40">
                    <button
                      type="button"
                      onClick={() => {
                        setConversationDataOpen(true);
                        setConversationMenuOpen(false);
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
                    >
                      {copy.chat.viewData}
                    </button>
                    {canShareConversationKey ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (hasConversationKey) {
                            openCopyConversationKeyDialog();
                          } else {
                            setConversationKeyError(null);
                            setConversationKeyDialog('add');
                          }
                          setConversationMenuOpen(false);
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
                      >
                        {hasConversationKey
                          ? copy.chat.copyPrivateKey
                          : copy.chat.addPrivateKey}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {!activeConversation ? (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="max-w-md">
            <img
              src="/noConversations.png"
              alt="Pigeon Swarm"
              className="mx-auto"
            />
            <h2 className="mt-6 text-3xl font-black tracking-tight">
              {copy.chat.emptyTitle}
            </h2>
            <p className="mt-3 text-white/55">{copy.chat.emptyBody}</p>
            <button
              onClick={onCreate}
              className="mt-6 rounded-2xl bg-fuchsia-500 px-5 py-3 font-black"
            >
              {copy.chat.createConversation}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={scrollerRef}
            onScroll={onScroll}
            className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          >
            {messageState === 'loading' && (
              <div className="mx-auto mb-4 w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/60">
                {copy.chat.loadingEvents}
              </div>
            )}
            <div className="space-y-2">
              {hasReachedMessageStart &&
                messages.length > 0 &&
                messageState !== 'loading' && (
                  <div className="mx-auto w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/35">
                    {copy.chat.noMoreMessages}
                  </div>
                )}
              {messages.map((message, index) => {
                const nextMessage = messages[index + 1];
                const replyMessage = message.replyToMessageId
                  ? messages.find(
                      (item) => item.id === message.replyToMessageId,
                    )
                  : undefined;
                const showAvatar =
                  !nextMessage ||
                  nextMessage.authorIdentityId !== message.authorIdentityId;

                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    currentIdentityId={session.identity.id}
                    authorName={
                      message.mine
                        ? session.identity.profile.name
                        : identityDisplayName(
                            message.authorIdentityId,
                            identityNames,
                          )
                    }
                    authorPicture={
                      message.mine
                        ? identityPictures[session.identity.id]
                        : identityPictures[message.authorIdentityId]
                    }
                    onAttachmentOpen={(attachmentIndex) =>
                      void openAttachment(message.attachments[attachmentIndex])
                    }
                    onAttachmentPreview={loadAttachmentPreview}
                    onAvatarClick={() => openMessageAuthorProfile(message)}
                    onMessageMenuOpen={onMessageMenuOpen}
                    onReplyReferenceClick={onReplyReferenceClick}
                    onRetryMessage={onRetryMessage}
                    replyImage={
                      replyMessage?.attachments.find((attachment) =>
                        isBrowserPreviewImage(attachment.contentType),
                      ) ?? message.replyPreview?.image
                    }
                    replyAuthorName={
                      replyMessage
                        ? identityDisplayName(
                            replyMessage.authorIdentityId,
                            identityNames,
                          )
                        : message.replyPreview
                          ? identityDisplayName(
                              message.replyPreview.authorIdentityId,
                              identityNames,
                            )
                          : undefined
                    }
                    replyPreview={
                      replyMessage?.content ?? message.replyPreview?.content
                    }
                    showAvatar={showAvatar}
                  />
                );
              })}
              {messages.length === 0 &&
                messageState !== 'loading' &&
                (hasConversationKey ? (
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-center text-sm text-white/55">
                    {copy.chat.emptyMessages}
                  </div>
                ) : (
                  <div className="grid min-h-[42vh] place-items-center">
                    <div className="w-full max-w-md rounded-3xl border border-rose-300/20 bg-rose-500/10 p-5 text-center text-sm text-rose-100">
                      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/15">
                        <LockIcon locked={false} />
                      </div>
                      <div className="font-black">{copy.chat.e2eMissing}</div>
                      <div className="mt-2 text-rose-100/65">
                        {copy.messages.missingConversationKey}
                      </div>
                    </div>
                  </div>
                ))}
              <div ref={bottomRef} />
            </div>
            {newMessageCount > 0 && (
              <button
                type="button"
                onClick={onJumpToLatest}
                className="sticky bottom-3 left-1/2 z-20 mt-3 -translate-x-1/2 rounded-full bg-fuchsia-500 px-4 py-2 text-xs font-black text-white shadow-xl shadow-fuchsia-950/30 transition hover:bg-fuchsia-400"
              >
                {copy.workspace.newMessages}
                {newMessageCount > 1 ? ` (${newMessageCount})` : ''}
              </button>
            )}
          </div>

          <Composer
            disabled={messageState === 'loading' || !hasConversationKey}
            draft={draft}
            error={sendError ?? attachmentError}
            onDraftChange={onDraftChange}
            onEscape={onEscape}
            onSend={onSend}
            onCancelReply={onCancelReply}
            progress={progress}
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
          identity={profileViewer.identity}
          identityId={profileViewer.identityId}
          name={profileViewer.name}
          nodeNetworks={nodeNetworks}
          onClose={() => setProfileViewer(null)}
          picture={profileViewer.picture}
        />
      )}
      {groupProfileOpen && activeConversation && (
        <GroupProfileDialog
          conversation={activeConversation}
          networkId={conversationNetworkId}
          nodeNetworks={nodeNetworks}
          onClose={() => setGroupProfileOpen(false)}
          onIdentityClick={(participant) => {
            setGroupProfileOpen(false);
            setProfileViewer({
              identity: participant.identity,
              identityId: participant.identityId,
              name: participant.name,
              picture: participant.picture,
            });
          }}
          participants={groupParticipants}
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
