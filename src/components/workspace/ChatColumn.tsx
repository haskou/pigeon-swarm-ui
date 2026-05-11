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
  messages: ChatMessage[];
  messageState: LoadState;
  nodeNetworks: NodeNetwork[];
  sendError: string | null;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onSend: (content: string, attachments: File[]) => Promise<void>;
  onOpenSidebar: () => void;
  onCreate: () => void;
  progress?: AttachmentProgress | null;
}

export function ChatColumn({
  activeConversation,
  bottomRef,
  hasConversationKey,
  identityNames,
  identityPictures,
  messages,
  messageState,
  nodeNetworks,
  onCreate,
  onOpenSidebar,
  onScroll,
  onSend,
  peerIdentity,
  peerIdentityId,
  peerPicture,
  scrollerRef,
  sendError,
  session,
  progress,
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
  const canOpenPeerProfile = !!activeConversation && !!peerIdentityId;
  const openOwnProfile = () =>
    setProfileViewer({
      identity: session.identity,
      identityId: session.identity.id,
      name: session.identity.profile.name,
      picture: session.identity.profile.picture,
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
            <button
              type="button"
              onClick={openPeerProfile}
              disabled={!canOpenPeerProfile}
              className="block max-w-full truncate text-left text-2xl font-black tracking-tight disabled:cursor-default"
            >
              {activeConversation
                ? (activeConversationName ?? activeConversation.id)
                : copy.chat.noConversation}
            </button>
            <div className="truncate text-sm text-white/50">
              {activeConversation
                ? `${copy.chat.directMessage} · ${activeConversation.id}`
                : copy.chat.noConversationHint}
            </div>
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
              {messages.map((message, index) => {
                const nextMessage = messages[index + 1];
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
                        ? session.identity.profile.picture
                        : identityPictures[message.authorIdentityId]
                    }
                    onAttachmentOpen={(attachmentIndex) =>
                      void openAttachment(message.attachments[attachmentIndex])
                    }
                    onAttachmentPreview={loadAttachmentPreview}
                    onAvatarClick={() => openMessageAuthorProfile(message)}
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
            progress={progress}
            placeholder={
              hasConversationKey
                ? copy.composer.placeholder
                : copy.messages.missingConversationKey
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
