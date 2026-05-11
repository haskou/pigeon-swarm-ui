import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../domain/types';
import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { CreateConversationDialog } from '../dialog/CreateConversationDialog';
import { ChatColumn } from './ChatColumn';
import { Inspector } from './Inspector';
import { Rail } from './Rail';
import { Sidebar } from './Sidebar';

type LoadState = 'idle' | 'loading' | 'error';

interface GlassWorkspaceProps {
  session: Session;
  setSession: (session: Session | null) => void;
  conversations: ConversationResource[];
  nodeNetworks: NodeNetwork[];
  setConversations: (conversations: ConversationResource[]) => void;
}

export function GlassWorkspace({
  conversations,
  nodeNetworks,
  session,
  setConversations,
  setSession,
}: GlassWorkspaceProps) {
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(conversations[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<LoadState>('idle');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ) ?? conversations[0],
    [activeConversationId, conversations],
  );

  useEffect(() => {
    if (!activeConversationId && conversations[0])
      setActiveConversationId(conversations[0].id);
  }, [activeConversationId, conversations]);

  const refreshConversations = useCallback(async () => {
    const next = await pigeonApplication.listConversations(session);
    setConversations(next);
  }, [session, setConversations]);

  const loadActiveMessages = useCallback(
    async (conversationId: string) => {
      setMessageState('loading');
      setSendError(null);
      try {
        const result = await pigeonApplication.loadMessages(
          session,
          conversationId,
        );
        setMessages(result.messages);
        setMessageCursor(result.nextCursor ?? result.messages[0]?.id ?? null);
        queueMicrotask(() =>
          bottomRef.current?.scrollIntoView({ block: 'end' }),
        );
      } catch (caught) {
        setMessages([]);
        setMessageState('error');
        setSendError(
          caught instanceof Error
            ? caught.message
            : copy.workspace.loadMessagesError,
        );

        return;
      }
      setMessageState('idle');
    },
    [session],
  );

  useEffect(() => {
    if (activeConversation?.id) void loadActiveMessages(activeConversation.id);
  }, [activeConversation?.id, loadActiveMessages]);

  const handleLoadOlder = async () => {
    if (!activeConversation?.id || messageState === 'loading') return;

    const previousHeight = scrollerRef.current?.scrollHeight ?? 0;
    setMessageState('loading');
    try {
      const result = await pigeonApplication.loadMessages(
        session,
        activeConversation.id,
        messageCursor,
      );
      setMessages((current) => [...result.messages, ...current]);
      setMessageCursor(
        result.nextCursor ?? result.messages[0]?.id ?? messageCursor,
      );
      requestAnimationFrame(() => {
        if (scrollerRef.current)
          scrollerRef.current.scrollTop =
            scrollerRef.current.scrollHeight - previousHeight;
      });
    } catch (caught) {
      setSendError(
        caught instanceof Error
          ? caught.message
          : copy.workspace.loadOlderError,
      );
    }
    setMessageState('idle');
  };

  const handleScroll = () => {
    if ((scrollerRef.current?.scrollTop ?? 0) < 80) void handleLoadOlder();
  };

  const handleSend = async (content: string) => {
    if (!activeConversation?.id) return;
    setSendError(null);

    try {
      const sent = await pigeonApplication.sendMessage(
        session,
        activeConversation.id,
        content,
      );
      setMessages((current) => [...current, sent]);
      queueMicrotask(() =>
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }),
      );
      void refreshConversations().catch(() => undefined);
    } catch (caught) {
      setSendError(
        caught instanceof Error ? caught.message : copy.workspace.sendError,
      );
    }
  };

  const handleConversationCreated = (
    nextSession: Session,
    conversation: ConversationResource,
  ) => {
    setSession(nextSession);
    setConversations([
      conversation,
      ...conversations.filter((item) => item.id !== conversation.id),
    ]);
    setActiveConversationId(conversation.id);
    setIsCreateOpen(false);
    setSidebarOpen(false);
  };

  return (
    <section className="relative z-10 min-h-screen pt-0 sm:pt-4">
      <div className="mx-auto grid h-screen max-w-[1800px] grid-cols-1 gap-0 px-0 pb-0 sm:h-[calc(100vh-1rem)] sm:gap-3 sm:px-4 sm:pb-4 lg:grid-cols-[82px_330px_minmax(0,1fr)] xl:grid-cols-[82px_330px_minmax(0,1fr)_320px]">
        <Rail />

        <div
          className={cx(
            'fixed inset-y-0 left-0 z-40 w-full max-w-none translate-x-0 p-0 transition sm:w-[86vw] sm:max-w-[360px] sm:p-3 lg:static lg:block lg:w-auto lg:max-w-none lg:p-0',
            sidebarOpen ? 'block' : 'hidden lg:block',
          )}
        >
          <Sidebar
            session={session}
            conversations={conversations}
            nodeNetworks={nodeNetworks}
            activeConversationId={activeConversation?.id ?? null}
            onSelect={(id) => {
              setActiveConversationId(id);
              setSidebarOpen(false);
            }}
            onCreate={() => setIsCreateOpen(true)}
            onLogout={() => setSession(null)}
          />
        </div>

        {sidebarOpen && (
          <button
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label={copy.workspace.closeSidebar}
          />
        )}

        <ChatColumn
          session={session}
          activeConversation={activeConversation}
          messages={messages}
          messageState={messageState}
          sendError={sendError}
          scrollerRef={scrollerRef}
          bottomRef={bottomRef}
          onScroll={handleScroll}
          onSend={handleSend}
          onOpenSidebar={() => setSidebarOpen(true)}
          onCreate={() => setIsCreateOpen(true)}
        />

        <Inspector
          session={session}
          activeConversation={activeConversation}
          messages={messages}
        />
      </div>

      {isCreateOpen && (
        <CreateConversationDialog
          session={session}
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleConversationCreated}
        />
      )}
    </section>
  );
}
