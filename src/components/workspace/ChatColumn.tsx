import { useState } from 'react';

import type {
  ChatMessage,
  ConversationResource,
  IdentityResource,
  Session,
} from '../../domain/types';

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
  sendError: string | null;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onSend: (content: string) => Promise<void>;
  onOpenSidebar: () => void;
  onCreate: () => void;
}

export function ChatColumn({
  activeConversation,
  bottomRef,
  hasConversationKey,
  identityNames,
  identityPictures,
  messages,
  messageState,
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
}: ChatColumnProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const activeConversationName = peerIdentityId
    ? identityDisplayName(peerIdentityId, identityNames)
    : activeConversation?.title;
  const canOpenPeerProfile = !!activeConversation && !!peerIdentityId;

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
            onClick={() => {
              if (canOpenPeerProfile) setProfileOpen(true);
            }}
            disabled={!canOpenPeerProfile}
            className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-indigo-400 font-black text-slate-950 disabled:cursor-default"
            aria-label={activeConversationName ?? copy.chat.noConversation}
          >
            {peerPicture ? (
              <img src={peerPicture} alt="" className="h-full w-full object-cover" />
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
              onClick={() => {
                if (canOpenPeerProfile) setProfileOpen(true);
              }}
              disabled={!canOpenPeerProfile}
              className="block max-w-full truncate text-left text-2xl font-black tracking-tight disabled:cursor-default"
            >
              {activeConversation
                ? (activeConversationName ?? activeConversation.id)
                : copy.chat.noConversation}
            </button>
            <div className="truncate text-sm text-white/50">
              {activeConversation
                ? `1to1 · ${activeConversation.id}`
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
              {messages.map((message) => (
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
                />
              ))}
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
            error={sendError}
            onSend={onSend}
            placeholder={
              hasConversationKey
                ? copy.composer.placeholder
                : copy.messages.missingConversationKey
            }
          />
        </>
      )}
      {profileOpen && peerIdentityId && activeConversationName && (
        <UserProfileDialog
          identity={peerIdentity}
          identityId={peerIdentityId}
          name={activeConversationName}
          onClose={() => setProfileOpen(false)}
          picture={peerPicture}
        />
      )}
    </section>
  );
}
