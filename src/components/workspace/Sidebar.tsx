import { useEffect, useRef, useState } from 'react';

import type { ConversationResource, Session } from '../../domain/types';
import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { conversationTitle, shortId } from '../../utils/formatting';
import {
  identityDisplayName,
  type IdentityNames,
} from '../../utils/identityDisplay';
import { SectionTitle } from '../common/SectionTitle';

interface SidebarProps {
  session: Session;
  conversations: ConversationResource[];
  nodeNetworks: NodeNetwork[];
  identityNames: IdentityNames;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onCreate: () => void;
  onLogout: () => void;
}

export function Sidebar({
  activeConversationId,
  conversations,
  identityNames,
  nodeNetworks,
  onClose,
  onCreate,
  onLogout,
  onSelect,
  session,
}: SidebarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [identityCopied, setIdentityCopied] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const networkNames = session.identity.networks.map(
    (networkId) =>
      nodeNetworks.find((network) => network.id === networkId)?.name ??
      shortId(networkId),
  );
  const conversationName = (conversation: ConversationResource) => {
    const peerIdentityId = conversation.peerIdentityId;

    return peerIdentityId
      ? identityDisplayName(peerIdentityId, identityNames)
      : conversationTitle(conversation);
  };

  const copyIdentityId = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(session.identity.id);
    }

    setIdentityCopied(true);
    window.setTimeout(() => setIdentityCopied(false), 1800);
  };

  useEffect(() => {
    if (!profileOpen) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointerDown);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
    };
  }, [profileOpen]);

  return (
    <aside className="glass-panel-strong flex h-full min-h-0 flex-col rounded-none p-4 sm:rounded-[2rem]">
      <div className="mb-4 flex items-center justify-end lg:hidden">
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.workspace.closeSidebar}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70"
        >
          ×
        </button>
      </div>

      <button
        onClick={onCreate}
        className="glass-button rounded-2xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 py-3 text-sm font-black shadow-xl shadow-fuchsia-950/20"
      >
        {copy.sidebar.createConversation}
      </button>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <SectionTitle title={copy.sidebar.oneToOneTitle} />
        <div className="space-y-2">
          {conversations.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
              {copy.sidebar.emptyConversations}
            </div>
          )}
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cx(
                'w-full rounded-3xl p-3 text-left transition',
                activeConversationId === conversation.id
                  ? 'bg-white text-slate-950'
                  : 'bg-white/8 text-white hover:bg-white/14',
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cx(
                    'grid h-11 w-11 place-items-center rounded-2xl text-sm font-black',
                    activeConversationId === conversation.id
                      ? 'bg-slate-950 text-white'
                      : 'bg-white/10 text-white',
                  )}
                >
                  {conversationName(conversation).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-black">
                    {conversationName(conversation)}
                  </div>
                  <div
                    className={cx(
                      'truncate text-xs',
                      activeConversationId === conversation.id
                        ? 'text-slate-500'
                        : 'text-white/45',
                    )}
                  >
                    {conversation.latestMessagePreview ??
                      shortId(conversation.peerIdentityId ?? conversation.id)}
                  </div>
                </div>
                {!!conversation.unreadCount && (
                  <span className="rounded-full bg-fuchsia-500 px-2 py-1 text-xs font-black text-white">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div ref={profileRef} className="relative mt-4">
        <button
          type="button"
          onClick={() => setProfileOpen((isOpen) => !isOpen)}
          className="flex w-full items-center gap-3 rounded-3xl bg-white/10 p-3 text-left transition hover:bg-white/14"
          aria-expanded={profileOpen}
        >
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-lg font-black text-slate-950">
            {session.identity.profile.name.slice(0, 1).toUpperCase() || 'P'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-black">
              {session.identity.profile.name}
            </div>
            <div className="truncate text-xs text-white/50">
              {shortId(session.identity.id)}
            </div>
          </div>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className={cx(
              'h-5 w-5 shrink-0 text-white/45 transition-transform',
              profileOpen && 'rotate-180',
            )}
          >
            <path
              d="M5 8l5 5 5-5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </button>

        {profileOpen && (
          <div className="absolute bottom-[calc(100%+.5rem)] left-0 right-0 z-20 rounded-3xl border border-white/10 bg-[#0c102b]/95 p-3 shadow-2xl shadow-black/45 backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-base font-black text-slate-950">
                {session.identity.profile.name.slice(0, 1).toUpperCase() || 'P'}
              </div>
              <div className="min-w-0">
                <div className="truncate font-black">
                  {session.identity.profile.name}
                </div>
                <div className="text-xs text-white/45">
                  v{session.identity.version}
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div>
                <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
                  {copy.profile.identityId}
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-black/25 p-2">
                  <span className="min-w-0 flex-1 truncate text-white/70">
                    {session.identity.id}
                  </span>
                  <button
                    type="button"
                    onClick={copyIdentityId}
                    className="shrink-0 rounded-xl bg-white px-2.5 py-1.5 font-black text-slate-950"
                  >
                    {identityCopied ? copy.profile.copied : copy.profile.copy}
                  </button>
                </div>
              </div>

              <ProfileDetail
                label={copy.profile.networks}
                value={
                  networkNames.length > 0
                    ? networkNames.join(', ')
                    : copy.profile.noNetworks
                }
              />
              <ProfileDetail
                label={copy.profile.keychainVersion}
                value={`v${session.keychain.version}`}
              />
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="mt-4 w-full rounded-2xl bg-rose-500/15 px-4 py-3 text-sm font-black text-rose-100 transition hover:bg-rose-500/25"
            >
              {copy.profile.logout}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>
      <div className="truncate rounded-2xl bg-black/25 px-3 py-2 text-white/70">
        {value}
      </div>
    </div>
  );
}
