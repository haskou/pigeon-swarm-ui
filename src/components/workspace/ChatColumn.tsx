import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../domain/types';

import { copy } from '../../i18n/en';
import { shortId } from '../../utils/formatting';
import {
  identityDisplayName,
  type IdentityNames,
} from '../../utils/identityDisplay';
import { Composer } from '../chat/Composer';
import { MessageBubble } from '../chat/MessageBubble';

type LoadState = 'idle' | 'loading' | 'error';

interface ChatColumnProps {
  session: Session;
  activeConversation?: ConversationResource;
  peerIdentityId?: string;
  identityNames: IdentityNames;
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
  identityNames,
  messages,
  messageState,
  onCreate,
  onOpenSidebar,
  onScroll,
  onSend,
  peerIdentityId,
  scrollerRef,
  sendError,
  session,
}: ChatColumnProps) {
  const activeConversationName = peerIdentityId
    ? identityDisplayName(peerIdentityId, identityNames)
    : activeConversation?.title;

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
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-indigo-400 font-black text-slate-950">
            {activeConversation
              ? (activeConversationName ?? activeConversation.id)
                  .slice(0, 1)
                  .toUpperCase()
              : '∅'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-black tracking-tight">
              {activeConversation
                ? (activeConversationName ?? activeConversation.id)
                : copy.chat.noConversation}
            </div>
            <div className="truncate text-sm text-white/50">
              {activeConversation
                ? `1to1 · ${shortId(activeConversation.id)}`
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
              className="mt-6 rounded-2xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-5 py-3 font-black"
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
            disabled={messageState === 'loading'}
            error={sendError}
            onSend={onSend}
          />
        </>
      )}
    </section>
  );
}
