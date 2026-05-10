import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_SERVER_URL } from './config';
import {
  createConversation,
  listConversations,
  loadMessages,
  login,
  register,
  sendMessage,
} from './domain/pigeonApi';
import type { ChatMessage, ConversationResource, Session } from './domain/types';

type AuthMode = 'login' | 'create';

type LoadState = 'idle' | 'loading' | 'error';

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<ConversationResource[]>([]);

  const handleAuthenticated = (nextSession: Session, nextConversations: ConversationResource[]) => {
    setSession(nextSession);
    setConversations(nextConversations);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080a25] text-white">
      <BackgroundGlow />
      {!session ? (
        <AuthScreen onAuthenticated={handleAuthenticated} />
      ) : (
        <GlassWorkspace
          session={session}
          setSession={setSession}
          conversations={conversations}
          setConversations={setConversations}
        />
      )}
    </main>
  );
}

function BackgroundGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-fuchsia-500/30 blur-3xl" />
      <div className="absolute right-0 top-1/4 h-[34rem] w-[34rem] rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,.10),transparent_35%)]" />
    </div>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session, conversations: ConversationResource[]) => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [identityId, setIdentityId] = useState('');
  const [name, setName] = useState('');
  const [networks, setNetworks] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = mode === 'login'
    ? identityId.trim().length > 0 && password.length > 0
    : name.trim().length > 0 && password.length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setState('loading');
    setError(null);

    try {
      const result = mode === 'login'
        ? await login(identityId, password)
        : await register(
            name,
            password,
            networks
              .split(',')
              .map((network) => network.trim())
              .filter(Boolean),
          );

      onAuthenticated(result.session, result.conversations);
    } catch (caught) {
      setState('error');
      setError(caught instanceof Error ? caught.message : 'Error desconocido. Qué poético, pero inútil.');
      return;
    }

    setState('idle');
  };

  return (
    <section className="relative z-10 grid min-h-screen place-items-center px-4 py-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_480px] lg:items-center">
        <div className="hidden lg:block">
          <div className="glass-panel-strong rounded-[2.5rem] p-8">
            <img src="/logo.png" alt="Pigeon Swarm" className="floaty h-28 w-28 rounded-[2rem] shadow-2xl shadow-indigo-950/40" />
            <h1 className="mt-8 max-w-xl text-6xl font-black tracking-[-.07em]">
              Glass client for a serverless little menace.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">
              Login local: se recoge la identidad por ID, se desencripta en el cliente con la contraseña, se baja el keychain y se cargan las conversaciones. O sea, lo mínimo para no convertir P2P en teatro corporativo.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <HeroMetric label="API" value={API_SERVER_URL.replace('http://', '')} />
              <HeroMetric label="Mode" value="1to1" />
              <HeroMetric label="Crypto" value="local" />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel-strong rounded-[2.5rem] p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Pigeon Swarm" className="h-14 w-14 rounded-2xl border border-white/15 shadow-lg" />
            <div>
              <div className="text-2xl font-black tracking-tight">Pigeon Swarm</div>
              <div className="text-sm text-white/55">API: {API_SERVER_URL}</div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={cx('rounded-xl px-4 py-3 text-sm font-black transition', mode === 'login' ? 'bg-white text-slate-950' : 'text-white/60 hover:text-white')}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('create')}
              className={cx('rounded-xl px-4 py-3 text-sm font-black transition', mode === 'create' ? 'bg-white text-slate-950' : 'text-white/60 hover:text-white')}
            >
              Create account
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {mode === 'login' ? (
              <Field label="Identity ID">
                <input
                  value={identityId}
                  onChange={(event) => setIdentityId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  placeholder="MCowBQYDK2VwAyEA..."
                  autoComplete="username"
                />
              </Field>
            ) : (
              <>
                <Field label="Profile name">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                    placeholder="Ada"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Networks, separados por coma">
                  <input
                    value={networks}
                    onChange={(event) => setNetworks(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                    placeholder="uuid-public, uuid-private"
                  />
                </Field>
              </>
            )}

            <Field label="Password">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                placeholder="••••••••••••"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </Field>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-4 text-sm text-rose-100">
              {error}
            </div>
          )}

          <button
            disabled={!canSubmit || state === 'loading'}
            className="glass-button mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-5 py-4 text-sm font-black text-white shadow-xl shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {state === 'loading' ? 'Derivando llaves y llamando a la API...' : mode === 'login' ? 'Decrypt identity & enter' : 'Create identity'}
          </button>
        </form>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[.22em] text-white/45">{label}</span>
      {children}
    </label>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-3xl p-4">
      <div className="text-xs font-black uppercase tracking-[.2em] text-white/40">{label}</div>
      <div className="mt-2 truncate text-lg font-black">{value}</div>
    </div>
  );
}

function GlassWorkspace({
  session,
  setSession,
  conversations,
  setConversations,
}: {
  session: Session;
  setSession: (session: Session | null) => void;
  conversations: ConversationResource[];
  setConversations: (conversations: ConversationResource[]) => void;
}) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversations[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<LoadState>('idle');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0],
    [activeConversationId, conversations],
  );

  useEffect(() => {
    if (!activeConversationId && conversations[0]) setActiveConversationId(conversations[0].id);
  }, [activeConversationId, conversations]);

  const refreshConversations = useCallback(async () => {
    const next = await listConversations(session);
    setConversations(next);
  }, [session, setConversations]);

  const loadActiveMessages = useCallback(async (conversationId: string) => {
    setMessageState('loading');
    setSendError(null);
    try {
      const result = await loadMessages(session, conversationId);
      setMessages(result.messages);
      setMessageCursor(result.nextCursor ?? result.messages[0]?.id ?? null);
      queueMicrotask(() => bottomRef.current?.scrollIntoView({ block: 'end' }));
    } catch (caught) {
      setMessages([]);
      setMessageState('error');
      setSendError(caught instanceof Error ? caught.message : 'No se han podido cargar mensajes. Enhorabuena, ya tenemos misterio.');
      return;
    }
    setMessageState('idle');
  }, [session]);

  useEffect(() => {
    if (activeConversation?.id) void loadActiveMessages(activeConversation.id);
  }, [activeConversation?.id, loadActiveMessages]);

  const handleLoadOlder = async () => {
    if (!activeConversation?.id || messageState === 'loading') return;

    const previousHeight = scrollerRef.current?.scrollHeight ?? 0;
    setMessageState('loading');
    try {
      const result = await loadMessages(session, activeConversation.id, messageCursor);
      setMessages((current) => [...result.messages, ...current]);
      setMessageCursor(result.nextCursor ?? result.messages[0]?.id ?? messageCursor);
      requestAnimationFrame(() => {
        if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight - previousHeight;
      });
    } catch (caught) {
      setSendError(caught instanceof Error ? caught.message : 'No se han podido cargar mensajes antiguos.');
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
      const sent = await sendMessage(session, activeConversation.id, content);
      setMessages((current) => [...current, sent]);
      queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
      void refreshConversations().catch(() => undefined);
    } catch (caught) {
      setSendError(caught instanceof Error ? caught.message : 'No se ha enviado. La paloma se ha estampado contra TLS.');
    }
  };

  const handleConversationCreated = (nextSession: Session, conversation: ConversationResource) => {
    setSession(nextSession);
    setConversations([conversation, ...conversations.filter((item) => item.id !== conversation.id)]);
    setActiveConversationId(conversation.id);
    setIsCreateOpen(false);
    setSidebarOpen(false);
  };

  return (
    <section className="relative z-10 min-h-screen pt-3 sm:pt-4">
      <div className="mx-auto grid h-[calc(100vh-.75rem)] max-w-[1800px] grid-cols-1 gap-3 px-3 pb-3 sm:h-[calc(100vh-1rem)] sm:px-4 sm:pb-4 lg:grid-cols-[82px_330px_minmax(0,1fr)] xl:grid-cols-[82px_330px_minmax(0,1fr)_320px]">
        <Rail onLogout={() => setSession(null)} />

        <div className={cx('fixed inset-y-0 left-0 z-40 w-[86vw] max-w-[360px] translate-x-0 p-3 transition lg:static lg:block lg:w-auto lg:max-w-none lg:p-0', sidebarOpen ? 'block' : 'hidden lg:block')}>
          <Sidebar
            session={session}
            conversations={conversations}
            activeConversationId={activeConversation?.id ?? null}
            onSelect={(id) => {
              setActiveConversationId(id);
              setSidebarOpen(false);
            }}
            onCreate={() => setIsCreateOpen(true)}
          />
        </div>

        {sidebarOpen && <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}

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

        <Inspector session={session} activeConversation={activeConversation} messages={messages} />
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

function Rail({ onLogout }: { onLogout: () => void }) {
  return (
    <aside className="hidden glass-panel rounded-[2rem] p-3 lg:flex lg:flex-col lg:items-center lg:gap-3">
      <img src="/logo.png" alt="Pigeon Swarm" className="h-14 w-14 rounded-2xl shadow-xl" />
      <div className="h-px w-10 bg-white/10" />
      {['PS', '1:1', 'VO', 'ID', 'KC'].map((item, index) => (
        <button key={item} className={cx('grid h-12 w-12 place-items-center rounded-2xl text-xs font-black transition', index === 0 ? 'bg-white text-slate-950' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white')}>
          {item}
        </button>
      ))}
      <button onClick={onLogout} className="mt-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-xs font-black text-rose-100 hover:bg-rose-500/25">
        Out
      </button>
    </aside>
  );
}

function Sidebar({
  session,
  conversations,
  activeConversationId,
  onSelect,
  onCreate,
}: {
  session: Session;
  conversations: ConversationResource[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <aside className="glass-panel-strong flex h-full min-h-0 flex-col rounded-[2rem] p-4">
      <div className="flex items-center gap-3 rounded-3xl bg-white/10 p-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-lg font-black text-slate-950">
          {session.identity.profile.name.slice(0, 1).toUpperCase() || 'P'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-black">{session.identity.profile.name}</div>
          <div className="truncate text-xs text-white/50">{shortId(session.identity.id)}</div>
        </div>
      </div>

      <button onClick={onCreate} className="glass-button mt-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 py-3 text-sm font-black shadow-xl shadow-fuchsia-950/20">
        + Crear conversación 1to1
      </button>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <SectionTitle title="Comunidades" />
        <div className="space-y-2 opacity-70">
          <PlaceholderRow title="Public Swarm" subtitle="future · communities" />
          <PlaceholderRow title="Private networks" subtitle="future · channels" />
        </div>

        <SectionTitle title="Mensajes 1to1" className="mt-6" />
        <div className="space-y-2">
          {conversations.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
              Aún no hay conversaciones. Crea una y por fin tendremos algo que mirar además del vacío.
            </div>
          )}
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cx('w-full rounded-3xl p-3 text-left transition', activeConversationId === conversation.id ? 'bg-white text-slate-950' : 'bg-white/8 text-white hover:bg-white/14')}
            >
              <div className="flex items-center gap-3">
                <div className={cx('grid h-11 w-11 place-items-center rounded-2xl text-sm font-black', activeConversationId === conversation.id ? 'bg-slate-950 text-white' : 'bg-white/10 text-white')}>
                  {conversationTitle(conversation).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-black">{conversationTitle(conversation)}</div>
                  <div className={cx('truncate text-xs', activeConversationId === conversation.id ? 'text-slate-500' : 'text-white/45')}>
                    {conversation.latestMessagePreview ?? shortId(conversation.peerIdentityId ?? conversation.id)}
                  </div>
                </div>
                {!!conversation.unreadCount && <span className="rounded-full bg-fuchsia-500 px-2 py-1 text-xs font-black text-white">{conversation.unreadCount}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function SectionTitle({ title, className }: { title: string; className?: string }) {
  return <div className={cx('mb-2 px-2 text-xs font-black uppercase tracking-[.22em] text-white/40', className)}>{title}</div>;
}

function PlaceholderRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl bg-white/6 px-3 py-2">
      <div className="text-sm font-black"># {title}</div>
      <div className="text-xs text-white/40">{subtitle}</div>
    </div>
  );
}

function ChatColumn({
  session,
  activeConversation,
  messages,
  messageState,
  sendError,
  scrollerRef,
  bottomRef,
  onScroll,
  onSend,
  onOpenSidebar,
  onCreate,
}: {
  session: Session;
  activeConversation?: ConversationResource;
  messages: ChatMessage[];
  messageState: LoadState;
  sendError: string | null;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onSend: (content: string) => Promise<void>;
  onOpenSidebar: () => void;
  onCreate: () => void;
}) {
  return (
    <section className="glass-panel-strong flex min-h-0 flex-col overflow-hidden rounded-[2rem]">
      <header className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <button onClick={onOpenSidebar} className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 font-black lg:hidden">
            ☰
          </button>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-indigo-400 font-black text-slate-950">
            {activeConversation ? conversationTitle(activeConversation).slice(0, 1).toUpperCase() : '∅'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-black tracking-tight">
              {activeConversation ? conversationTitle(activeConversation) : 'Sin conversación'}
            </div>
            <div className="truncate text-sm text-white/50">
              {activeConversation ? `1to1 · ${shortId(activeConversation.id)} · keychain local` : 'Crea una conversación para empezar'}
            </div>
          </div>
          <button onClick={onCreate} className="hidden rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 sm:block">
            New 1to1
          </button>
        </div>
      </header>

      {!activeConversation ? (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="max-w-md">
            <img src="/logo.png" alt="Pigeon Swarm" className="mx-auto h-24 w-24 rounded-[2rem] shadow-2xl" />
            <h2 className="mt-6 text-3xl font-black tracking-tight">No hay conversaciones</h2>
            <p className="mt-3 text-white/55">Crea un 1to1 introduciendo el ID de la identidad remota. Súper romántico, si tu idea de romance incluye claves privadas.</p>
            <button onClick={onCreate} className="mt-6 rounded-2xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-5 py-3 font-black">
              Crear conversación
            </button>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollerRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {messageState === 'loading' && (
              <div className="mx-auto mb-4 w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/60">
                Cargando eventos...
              </div>
            )}
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} currentIdentityId={session.identity.id} />
              ))}
              {messages.length === 0 && messageState !== 'loading' && (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-center text-sm text-white/55">
                  No hay mensajes visibles. Enviar el primero suele ayudar, brutal hallazgo de producto.
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <Composer disabled={messageState === 'loading'} error={sendError} onSend={onSend} />
        </>
      )}
    </section>
  );
}

function MessageBubble({ message, currentIdentityId }: { message: ChatMessage; currentIdentityId: string }) {
  const mine = message.mine || message.authorIdentityId === currentIdentityId;

  return (
    <div className={cx('flex gap-3', mine && 'justify-end')}>
      {!mine && <Avatar label={message.authorIdentityId} />}
      <div className={cx('max-w-[86%] rounded-3xl p-3 text-sm leading-relaxed sm:max-w-[72%]', mine ? 'bg-fuchsia-500 text-white shadow-xl shadow-fuchsia-950/20' : 'border border-white/10 bg-black/25 text-white')}>
        <div className="mb-1 flex items-center justify-between gap-4 text-xs font-black opacity-75">
          <span>{mine ? 'You' : shortId(message.authorIdentityId)}</span>
          <span>{formatTime(message.timestamp)}</span>
        </div>
        <p className={cx(message.encrypted && 'text-white/55')}>{message.content}</p>
      </div>
      {mine && <Avatar label="You" mine />}
    </div>
  );
}

function Avatar({ label, mine }: { label: string; mine?: boolean }) {
  return (
    <div className={cx('mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm font-black', mine ? 'bg-white text-slate-950' : 'bg-white/10 text-white')}>
      {label.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Composer({ disabled, error, onSend }: { disabled: boolean; error: string | null; onSend: (content: string) => Promise<void> }) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    await onSend(trimmed);
    setSending(false);
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-white/10 p-4 sm:p-5">
      {error && <div className="mb-3 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">{error}</div>}
      <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-black/20 p-2">
        <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 font-black text-white/70">
          +
        </button>
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={disabled || sending}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/35 disabled:opacity-50"
          placeholder="Escribe, cifra, firma y empuja al swarm..."
        />
        <button disabled={!content.trim() || disabled || sending} className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45">
          {sending ? 'Sending' : 'Send'}
        </button>
      </div>
    </form>
  );
}

function Inspector({ session, activeConversation, messages }: { session: Session; activeConversation?: ConversationResource; messages: ChatMessage[] }) {
  const key = activeConversation ? session.keychain.conversations[activeConversation.id] : undefined;

  return (
    <aside className="hidden glass-panel rounded-[2rem] p-4 xl:block">
      <SectionTitle title="Identity" />
      <div className="rounded-3xl bg-white/8 p-4">
        <div className="font-black">{session.identity.profile.name}</div>
        <div className="mt-1 break-all text-xs text-white/45">{session.identity.id}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Badge label={`v${session.identity.version}`} />
          <Badge label={`${session.identity.networks.length} nets`} />
        </div>
      </div>

      <SectionTitle title="Conversation keychain" className="mt-6" />
      <div className="rounded-3xl bg-white/8 p-4">
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-white/50">Private key</span>
          <b className={key ? 'text-emerald-300' : 'text-rose-300'}>{key ? 'present' : 'missing'}</b>
        </div>
        <div className="mt-3 flex justify-between gap-3 text-sm">
          <span className="text-white/50">Keychain version</span>
          <b>{session.keychain.version}</b>
        </div>
        <div className="mt-3 flex justify-between gap-3 text-sm">
          <span className="text-white/50">Stored 1to1 keys</span>
          <b>{Object.keys(session.keychain.conversations).length}</b>
        </div>
      </div>

      <SectionTitle title="Loaded messages" className="mt-6" />
      <div className="rounded-3xl bg-white/8 p-4">
        <div className="text-4xl font-black">{messages.length}</div>
        <div className="mt-1 text-sm text-white/45">events projected locally</div>
      </div>

      <SectionTitle title="Future" className="mt-6" />
      <div className="space-y-2 text-sm text-white/55">
        <div className="rounded-2xl bg-white/8 p-3">Communities: same sidebar slot, disabled for now.</div>
        <div className="rounded-2xl bg-white/8 p-3">Voice: channel model already has a home in the rail.</div>
      </div>
    </aside>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full bg-white/10 px-3 py-1 text-center font-black text-white/70">{label}</span>;
}

function CreateConversationDialog({
  session,
  onClose,
  onCreated,
}: {
  session: Session;
  onClose: () => void;
  onCreated: (session: Session, conversation: ConversationResource) => void;
}) {
  const [peerIdentityId, setPeerIdentityId] = useState('');
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!peerIdentityId.trim()) return;

    setState('loading');
    setError(null);

    try {
      const result = await createConversation(session, peerIdentityId);
      onCreated({
        ...session,
        keychain: result.keychain,
        keychainExternalIdentifier: result.keychainExternalIdentifier,
      }, result.conversation);
    } catch (caught) {
      setState('error');
      setError(caught instanceof Error ? caught.message : 'No se ha podido crear la conversación. El backend ha elegido violencia.');
      return;
    }

    setState('idle');
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="glass-panel-strong w-full max-w-xl rounded-[2rem] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight">Crear conversación 1to1</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Introduce el ID de la identidad remota. El cliente resuelve esa identidad, crea la conversación, genera una keypair de conversación y guarda la clave privada en tu keychain cifrado.
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 font-black">
            ×
          </button>
        </div>

        <Field label="Remote identity ID">
          <textarea
            value={peerIdentityId}
            onChange={(event) => setPeerIdentityId(event.target.value)}
            className="min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
            placeholder="MCowBQYDK2VwAyEA..."
          />
        </Field>

        {error && <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">{error}</div>}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white/70">
            Cancelar
          </button>
          <button disabled={!peerIdentityId.trim() || state === 'loading'} className="glass-button rounded-2xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45">
            {state === 'loading' ? 'Creando y publicando keychain...' : 'Crear conversación'}
          </button>
        </div>
      </form>
    </div>
  );
}

function conversationTitle(conversation: ConversationResource) {
  return conversation.title ?? conversation.peerIdentityId ?? conversation.participantIdentityIds?.join(' ↔ ') ?? conversation.id;
}

function shortId(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

export default App;
