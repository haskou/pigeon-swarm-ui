import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type {
  ConversationResource,
  IdentityResource,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { conversationPeerIdentityId } from '../../domain/conversations/conversationPeer';
import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { conversationTitle, shortId } from '../../utils/formatting';
import {
  identityDisplayName,
  type IdentityNames,
  type IdentityPictures,
  isValidHandle,
  normalizeHandle,
} from '../../utils/identityDisplay';
import { SectionTitle } from '../common/SectionTitle';

interface SidebarProps {
  session: Session;
  conversations: ConversationResource[];
  nodeNetworks: NodeNetwork[];
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onCreate: () => void;
  onLogout: () => void;
  onSessionUpdated: (session: Session) => void;
}

export function Sidebar({
  activeConversationId,
  conversations,
  identityNames,
  identityPictures,
  identityProfiles,
  nodeNetworks,
  onClose,
  onCreate,
  onLogout,
  onSelect,
  onSessionUpdated,
  session,
}: SidebarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [identityCopied, setIdentityCopied] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const networkNames = session.identity.networks.map(
    (networkId) =>
      nodeNetworks.find((network) => network.id === networkId)?.name ??
      shortId(networkId),
  );
  const ownDisplayName = identityDisplayName(
    session.identity.id,
    identityNames,
  );
  const ownProfileName =
    session.identity.profile.name.trim() ||
    (session.identity.profile.handle?.trim()
      ? `@${session.identity.profile.handle.trim()}`
      : ownDisplayName);
  const ownProfileHandle = session.identity.profile.handle?.trim()
    ? `@${session.identity.profile.handle.trim()}`
    : shortId(session.identity.id);
  const ownPicture =
    session.identity.profile.picture ?? identityPictures[session.identity.id];
  const conversationPeerId = (conversation: ConversationResource) =>
    conversationPeerIdentityId(
      conversation,
      session.identity.id,
      session.keychain,
    );

  const conversationName = (conversation: ConversationResource) => {
    const peerIdentityId = conversationPeerId(conversation);
    const peerProfile = peerIdentityId
      ? identityProfiles[peerIdentityId]?.profile
      : undefined;
    const peerName = peerProfile?.name.trim();
    const peerHandle = peerProfile?.handle?.trim();

    return peerName
      ? peerName
      : peerHandle
        ? `@${peerHandle}`
        : peerIdentityId
          ? identityDisplayName(peerIdentityId, identityNames)
          : conversationTitle(conversation);
  };
  const conversationHandle = (conversation: ConversationResource) => {
    const peerIdentityId = conversationPeerId(conversation);
    const peerHandle = peerIdentityId
      ? identityProfiles[peerIdentityId]?.profile.handle?.trim()
      : undefined;

    return peerHandle
      ? `@${peerHandle}`
      : peerIdentityId
        ? shortId(peerIdentityId)
        : conversationTitle(conversation);
  };
  const conversationPicture = (conversation: ConversationResource) => {
    const peerIdentityId = conversationPeerId(conversation);

    return peerIdentityId ? identityPictures[peerIdentityId] : undefined;
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
        className="glass-button rounded-2xl bg-fuchsia-500 px-4 py-3 text-sm font-black shadow-xl shadow-fuchsia-950/20"
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
                    'grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-sm font-black text-slate-950',
                    activeConversationId === conversation.id &&
                      'ring-2 ring-slate-950/20',
                  )}
                >
                  {conversationPicture(conversation) ? (
                    <img
                      src={conversationPicture(conversation)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    conversationName(conversation).slice(0, 1).toUpperCase()
                  )}
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
                    {conversationHandle(conversation)}
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
          <ProfileAvatar
            label={ownDisplayName}
            picture={ownPicture}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-black">{ownProfileName}</div>
            <div className="truncate text-xs text-white/50">
              {ownProfileHandle}
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
              <ProfileAvatar label={ownDisplayName} picture={ownPicture} />
              <div className="min-w-0">
                <div className="truncate font-black">{ownProfileName}</div>
                <div className="truncate text-xs text-white/45">
                  {ownProfileHandle}
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div className="text-xs text-white/45">
                {session.identity.profile.biography?.trim() || ''}
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
              onClick={() => setProfileEditorOpen(true)}
              className="mt-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
            >
              {copy.profile.edit}
            </button>

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

      {profileEditorOpen && (
        <ProfileEditor
          session={session}
          onClose={() => setProfileEditorOpen(false)}
          onUpdated={(nextSession) => {
            onSessionUpdated(nextSession);
            setProfileEditorOpen(false);
          }}
        />
      )}
    </aside>
  );
}

function ProfileAvatar({
  label,
  picture,
  size = 'md',
}: {
  label: string;
  picture?: string | null;
  size?: 'lg' | 'md' | 'xl';
}) {
  return (
    <div
      className={cx(
        'grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950',
        size === 'xl'
          ? 'h-16 w-16 text-2xl'
          : size === 'lg'
            ? 'h-12 w-12 text-lg'
            : 'h-11 w-11 text-base',
      )}
    >
      {picture ? (
        <img src={picture} alt="" className="h-full w-full object-cover" />
      ) : (
        label.slice(0, 1).toUpperCase() || 'P'
      )}
    </div>
  );
}

function ProfileEditor({
  onClose,
  onUpdated,
  session,
}: {
  session: Session;
  onClose: () => void;
  onUpdated: (session: Session) => void;
}) {
  const [name, setName] = useState(session.identity.profile.name);
  const [handle, setHandle] = useState(session.identity.profile.handle ?? '');
  const [biography, setBiography] = useState(
    session.identity.profile.biography ?? '',
  );
  const [picture, setPicture] = useState(
    session.identity.profile.picture ?? '',
  );
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const normalizedHandle = handle.trim() ? normalizeHandle(handle) : undefined;
  const canSubmit =
    name.trim().length > 0 &&
    (!normalizedHandle || isValidHandle(normalizedHandle)) &&
    state !== 'loading';

  const handlePictureChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') setPicture(reader.result);
    });
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canSubmit) return;

    setState('loading');
    setError(null);
    try {
      const identity = await pigeonApplication.updateIdentityProfile(session, {
        biography: biography.trim() || undefined,
        handle: normalizedHandle,
        name: name.trim(),
        picture: picture || undefined,
      });

      onUpdated({ ...session, identity });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : copy.profile.updateError,
      );
    }
    setState('idle');
  };

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <form
        onSubmit={handleSubmit}
        className="glass-panel-strong relative z-10 w-full max-w-lg rounded-[2rem] p-5 shadow-2xl shadow-black/35"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <h2 className="text-xl font-black">{copy.profile.edit}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          <div className="grid gap-2 text-sm font-black text-white/70">
            {copy.profile.picture}
            <div className="flex items-center gap-4 rounded-3xl bg-black/20 p-3">
              <ProfileAvatar
                label={name || session.identity.id}
                picture={picture}
                size="xl"
              />
              <input
                type="file"
                accept="image/*"
                onChange={handlePictureChange}
                className="min-w-0 flex-1 text-sm text-white/60 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:font-black file:text-slate-950"
              />
            </div>
          </div>
          <ProfileInput
            label={copy.profile.name}
            value={name}
            onChange={setName}
          />
          <ProfileInput
            label={copy.profile.handle}
            value={handle}
            onChange={setHandle}
            placeholder="@ada"
          />
          <label className="grid gap-2 text-sm font-black text-white/70">
            {copy.profile.biography}
            <textarea
              value={biography}
              onChange={(event) => setBiography(event.target.value)}
              className="min-h-24 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
            />
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <button
          disabled={!canSubmit}
          className="mt-5 w-full rounded-2xl bg-fuchsia-500 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {state === 'loading' ? copy.profile.saving : copy.profile.save}
        </button>
      </form>
    </div>,
    document.body,
  );
}

function ProfileInput({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-white/70">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
      />
    </label>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>
      <div className="min-w-0 break-words rounded-2xl bg-black/25 px-3 py-2 text-white/70">
        {value}
      </div>
    </div>
  );
}
