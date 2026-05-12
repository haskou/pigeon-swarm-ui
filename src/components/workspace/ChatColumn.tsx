import { useCallback, useState } from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type {
  AttachmentProgress,
  ChatMessage,
  ConversationResource,
  IdentityResource,
  MessageAttachment,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { isBrowserPreviewImage } from '../../utils/browserPreview';
import { shortId } from '../../utils/formatting';
import {
  identityDisplayName,
  type IdentityNames,
  type IdentityPictures,
} from '../../utils/identityDisplay';
import { Composer } from '../chat/Composer';
import { MessageBubble } from '../chat/MessageBubble';
import { UserProfileDialog } from '../profile/UserProfileDialog';

type LoadState = 'idle' | 'loading' | 'error';

interface ChatColumnProps {
  session: Session;
  activeConversation?: ConversationResource;
  peerIdentityId?: string;
  peerIdentity?: IdentityResource;
  peerPicture?: string;
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  hasConversationKey: boolean;
  hasReachedMessageStart: boolean;
  messages: ChatMessage[];
  messageState: LoadState;
  nodeNetworks: NodeNetwork[];
  sendError: string | null;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onSend: (content: string, attachments: File[]) => Promise<void>;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onReplyReferenceClick: (messageId: string) => void;
  onOpenSidebar: () => void;
  onCreate: () => void;
  progress?: AttachmentProgress | null;
  replyToMessage?: ChatMessage | null;
  onCancelReply: () => void;
}

export function ChatColumn({
  activeConversation,
  bottomRef,
  hasConversationKey,
  hasReachedMessageStart,
  identityNames,
  identityPictures,
  messages,
  messageState,
  nodeNetworks,
  onCreate,
  onOpenSidebar,
  onReplyReferenceClick,
  onScroll,
  onSend,
  onMessageMenuOpen,
  onCancelReply,
  peerIdentity,
  peerIdentityId,
  peerPicture,
  scrollerRef,
  sendError,
  session,
  progress,
  replyToMessage,
}: ChatColumnProps) {
  const [profileViewer, setProfileViewer] = useState<{
    identity?: IdentityResource;
    identityId: string;
    name: string;
    picture?: string | null;
  } | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const activeConversationName = peerIdentityId
    ? identityDisplayName(peerIdentityId, identityNames)
    : activeConversation?.title;
  const activeConversationFallbackName = activeConversationName?.replace(
    /\s+\(@[^)]+\)$/,
    '',
  );
  const activeConversationTitle =
    peerIdentity?.profile.name.trim() ||
    (peerIdentity?.profile.handle?.trim()
      ? `@${peerIdentity.profile.handle.trim()}`
      : activeConversationFallbackName);
  const conversationNetworkId =
    peerIdentity?.networks.find((networkId) =>
      session.identity.networks.includes(networkId),
    ) ?? session.identity.networks[0];
  const conversationNetworkName = conversationNetworkId
    ? (nodeNetworks.find((network) => network.id === conversationNetworkId)
        ?.name ?? shortId(conversationNetworkId))
    : copy.profile.noNetworks;
  const conversationNetworkTooltip =
    conversationNetworkId ?? copy.profile.noNetworks;
  const e2eTooltip = hasConversationKey
    ? copy.chat.e2eReady
    : copy.chat.e2eMissing;
  const canOpenPeerProfile = !!activeConversation && !!peerIdentityId;
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
  const openMessageAuthorProfile = (message: ChatMessage) => {
    if (message.mine || message.authorIdentityId === session.identity.id) {
      openOwnProfile();
      return;
    }

    setProfileViewer({
      identity: peerIdentity,
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
            onClick={openPeerProfile}
            disabled={!canOpenPeerProfile}
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
                onClick={openPeerProfile}
                disabled={!canOpenPeerProfile}
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
                <span className="shrink-0">{copy.chat.directMessage}</span>
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
            <div className="space-y-4">
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
              {messages.length === 0 && messageState !== 'loading' && (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-center text-sm text-white/55">
                  {copy.chat.emptyMessages}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <Composer
            disabled={messageState === 'loading' || !hasConversationKey}
            error={sendError ?? attachmentError}
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
    </section>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d={
          locked
            ? 'M7 10V8a5 5 0 0 1 10 0v2'
            : 'M9 10V8a5 5 0 0 1 8.7-3.4'
        }
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M6.5 10h11A1.5 1.5 0 0 1 19 11.5v7A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 14v2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
