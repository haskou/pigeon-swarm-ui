import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { CallSession } from '../../domain/calls/CallSession';
import type {
  ConversationResource,
  IdentityResource,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { conversationPeerIdentityId } from '../../domain/conversations/conversationPeer';
import { ProfileBiography } from '../../domain/identities/profile/ProfileBiography';
import { ProfileHandle } from '../../domain/identities/profile/ProfileHandle';
import { ProfileName } from '../../domain/identities/profile/ProfileName';
import { copy } from '../../i18n/en';
import {
  getInitialLanguage,
  languageOptions,
  saveLanguage,
  type AppLanguage,
} from '../../i18n/language';
import { cx } from '../../utils/classNameHelper';
import {
  isValidPassword,
  passwordValidationChecks,
} from '../../utils/credentialsValidation';
import { conversationTitle, shortId } from '../../utils/formatting';
import {
  identityBanner,
  identityDisplayName,
  identityPicture,
  type IdentityNames,
  type IdentityPictures,
  isValidHandle,
  profilePictureDataUrl,
  profilePictureUrl,
  normalizeHandle,
} from '../../utils/identityDisplay';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { GlobalCallBar } from '../calls/GlobalCallBar';
import { GlassSelect } from '../common/GlassSelect';
import { ImageCropEditor } from '../common/ImageCropEditor';
import { SectionTitle } from '../common/SectionTitle';
import { loadPublicImage } from '../community/communityImages';

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
  activeCall?: CallSession | null;
  onCallEnd?: () => void;
  onCallParticipantVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallToggleCamera?: () => void;
  onCallToggleDeafen?: () => void;
  onCallToggleMute?: () => void;
  onCallToggleScreenShare?: () => void;
}

export function Sidebar({
  activeCall,
  activeConversationId,
  conversations,
  identityNames,
  identityPictures,
  identityProfiles,
  nodeNetworks,
  onCallEnd,
  onCallParticipantVolumeChange,
  onCallToggleCamera,
  onCallToggleDeafen,
  onCallToggleMute,
  onCallToggleScreenShare,
  onClose,
  onCreate,
  onLogout,
  onSelect,
  onSessionUpdated,
  session,
}: SidebarProps) {
  const [conversationSearch, setConversationSearch] = useState('');
  const conversationBannerUrls = useIdentityBannerUrls(
    identityProfiles,
    filteredConversationPeerIdentityIds(
      conversations,
      session.identity.id,
      session.keychain,
    ),
  );
  const conversationPeerId = (conversation: ConversationResource) =>
    conversationPeerIdentityId(
      conversation,
      session.identity.id,
      session.keychain,
    );

  const conversationName = (conversation: ConversationResource) => {
    if (isGroupConversation(conversation)) {
      return conversation.name ?? conversation.title ?? conversation.id;
    }

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
    if (isGroupConversation(conversation)) {
      const memberCount = conversationParticipants(conversation).length;

      return `${memberCount} ${copy.sidebar.members}`;
    }

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
    if (isGroupConversation(conversation)) return undefined;

    const peerIdentityId = conversationPeerId(conversation);

    return peerIdentityId ? identityPictures[peerIdentityId] : undefined;
  };
  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();

    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const peerIdentityId = conversationPeerId(conversation);
      const searchable = [
        conversation.id,
        conversationName(conversation),
        conversationHandle(conversation),
        peerIdentityId ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [conversationSearch, conversations, identityNames, identityProfiles]);

  return (
    <aside className="glass-panel-strong flex h-full min-h-0 flex-col rounded-none p-4">
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
        <input
          value={conversationSearch}
          onChange={(event) => setConversationSearch(event.target.value)}
          className="mb-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-300/60"
          placeholder={copy.sidebar.searchConversations}
        />
        <div className="space-y-2">
          {filteredConversations.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
              {copy.sidebar.emptyConversations}
            </div>
          )}
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cx(
                'relative w-full overflow-hidden rounded-2xl p-3 text-left transition',
                activeConversationId === conversation.id
                  ? 'bg-white text-slate-950'
                  : 'bg-white/8 text-white hover:bg-white/14',
              )}
            >
              {conversationBannerUrls[conversation.id] && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(90deg, rgba(6,8,26,0) 0%, rgba(6,8,26,0) 50%, rgba(6,8,26,.62) 100%), url(${conversationBannerUrls[conversation.id]})`,
                    maskImage:
                      'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 56%, rgba(0,0,0,.55) 72%, black 100%)',
                    WebkitMaskImage:
                      'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 56%, rgba(0,0,0,.55) 72%, black 100%)',
                  }}
                />
              )}
              <div className="relative flex items-center gap-3">
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

      <UserProfileDropdown
        identityNames={identityNames}
        identityPictures={identityPictures}
        nodeNetworks={nodeNetworks}
        onLogout={onLogout}
        onSessionUpdated={onSessionUpdated}
        session={session}
        activeCall={activeCall}
        onCallEnd={onCallEnd}
        onCallParticipantVolumeChange={onCallParticipantVolumeChange}
        onCallToggleCamera={onCallToggleCamera}
        onCallToggleDeafen={onCallToggleDeafen}
        onCallToggleMute={onCallToggleMute}
        onCallToggleScreenShare={onCallToggleScreenShare}
      />
    </aside>
  );
}

function filteredConversationPeerIdentityIds(
  conversations: ConversationResource[],
  currentIdentityId: string,
  keychain: Session['keychain'],
): Record<string, string> {
  return Object.fromEntries(
    conversations
      .map((conversation) => [
        conversation.id,
        conversationPeerIdentityId(conversation, currentIdentityId, keychain),
      ])
      .filter((entry): entry is [string, string] => !!entry[1]),
  );
}

function useIdentityBannerUrls(
  identities: Record<string, IdentityResource>,
  identityIdsByKey: Record<string, string>,
): Record<string, string> {
  const [bannerUrls, setBannerUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const entries = Object.entries(identityIdsByKey)
      .map(([key, identityId]) => [key, identities[identityId]] as const)
      .filter(
        (entry): entry is readonly [string, IdentityResource] =>
          !!entry[1]?.profile.banner && !bannerUrls[entry[0]],
      );

    if (entries.length === 0) return;

    let cancelled = false;

    void Promise.all(
      entries.map(async ([key, identity]) => {
        const directBanner = identityBanner(identity);

        if (directBanner) return [key, directBanner] as const;

        const bannerCid = identity.profile.banner?.trim();

        if (!bannerCid) return null;

        const loadedBanner = await loadPublicImage(bannerCid);

        return loadedBanner ? ([key, loadedBanner] as const) : null;
      }),
    )
      .then((loaded) => {
        if (cancelled) return;

        const nextUrls = loaded.filter(
          (entry): entry is readonly [string, string] => entry !== null,
        );

        if (nextUrls.length === 0) return;

        setBannerUrls((current) => ({
          ...current,
          ...Object.fromEntries(nextUrls),
        }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [bannerUrls, identities, identityIdsByKey]);

  return bannerUrls;
}

export function UserProfileDropdown({
  activeCall,
  identityNames = {},
  identityPictures = {},
  nodeNetworks,
  onCallEnd,
  onCallParticipantVolumeChange,
  onCallToggleCamera,
  onCallToggleDeafen,
  onCallToggleMute,
  onCallToggleScreenShare,
  onLogout,
  onSessionUpdated,
  session,
}: {
  identityNames?: IdentityNames;
  identityPictures?: IdentityPictures;
  nodeNetworks: NodeNetwork[];
  onLogout: () => void;
  onSessionUpdated: (session: Session) => void;
  session: Session;
  activeCall?: CallSession | null;
  onCallEnd?: () => void;
  onCallParticipantVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallToggleCamera?: () => void;
  onCallToggleDeafen?: () => void;
  onCallToggleMute?: () => void;
  onCallToggleScreenShare?: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [identityCopied, setIdentityCopied] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>(getInitialLanguage);
  const profileRef = useRef<HTMLDivElement>(null);
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
    identityPictures[session.identity.id] ?? identityPicture(session.identity);
  const [ownBanner, setOwnBanner] = useState<string | null>(() =>
    identityBanner(session.identity),
  );

  useEffect(() => {
    const directBanner = identityBanner(session.identity);

    if (directBanner) {
      setOwnBanner(directBanner);

      return;
    }

    const bannerCid = session.identity.profile.banner?.trim();

    if (!bannerCid) {
      setOwnBanner(null);

      return;
    }

    let cancelled = false;

    void loadPublicImage(bannerCid)
      .then((url) => {
        if (!cancelled) setOwnBanner(url);
      })
      .catch(() => {
        if (!cancelled) setOwnBanner(null);
      });

    return () => {
      cancelled = true;
    };
  }, [session.identity]);

  const copyIdentityId = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(session.identity.id);
    }

    setIdentityCopied(true);
    window.setTimeout(() => setIdentityCopied(false), 1800);
  };

  const changeLanguage = (nextLanguage: string) => {
    setLanguage(saveLanguage(nextLanguage));
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
    <div ref={profileRef} className="relative mt-4 shrink-0">
      {activeCall &&
        onCallEnd &&
        onCallParticipantVolumeChange &&
        onCallToggleCamera &&
        onCallToggleDeafen &&
        onCallToggleMute &&
        onCallToggleScreenShare && (
          <div className="absolute bottom-[calc(100%+.5rem)] left-0 right-0 z-30">
            <GlobalCallBar
              call={activeCall}
              onEnd={onCallEnd}
              onParticipantVolumeChange={onCallParticipantVolumeChange}
              onToggleCamera={onCallToggleCamera}
              onToggleDeafen={onCallToggleDeafen}
              onToggleMute={onCallToggleMute}
              onToggleScreenShare={onCallToggleScreenShare}
            />
          </div>
        )}
      <button
        type="button"
        onClick={() => setProfileOpen((isOpen) => !isOpen)}
        className="flex w-full items-center gap-3 rounded-2xl bg-white/10 p-3 text-left transition hover:bg-white/14"
        aria-expanded={profileOpen}
      >
        <ProfileAvatar label={ownDisplayName} picture={ownPicture} size="lg" />
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
        <div
          className={cx(
            'absolute left-0 right-0 z-40 rounded-2xl border border-white/10 bg-[#0c102b]/95 p-3 shadow-2xl shadow-black/45 backdrop-blur-xl',
            activeCall
              ? 'bottom-[calc(100%+5.75rem)]'
              : 'bottom-[calc(100%+.5rem)]',
          )}
        >
          <div className="-m-3 mb-3 overflow-hidden rounded-t-2xl border-b border-white/10">
            <div className="relative h-28 overflow-hidden bg-gradient-to-br from-slate-900 via-fuchsia-950 to-cyan-900">
              {ownBanner && (
                <>
                  <img
                    src={ownBanner}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900/25 via-fuchsia-950/50 to-cyan-900/45" />
                </>
              )}
            </div>
            <div className="relative px-3 pb-3">
              <div className="-mt-10 flex items-end gap-3">
                <ProfileAvatar
                  label={ownDisplayName}
                  picture={ownPicture}
                  size="lg"
                />
                <div className="min-w-0 pb-1">
                  <div className="truncate font-black">{ownProfileName}</div>
                  <div className="truncate text-xs text-white/45">
                    {ownProfileHandle}
                  </div>
                </div>
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
                  className="shrink-0 rounded-2xl bg-white px-2.5 py-1.5 font-black text-slate-950"
                >
                  {identityCopied ? copy.profile.copied : copy.profile.copy}
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
                {copy.profile.language}
              </div>
              <GlassSelect
                ariaLabel={copy.profile.language}
                onChange={changeLanguage}
                options={languageOptions}
                value={language}
              />
            </div>
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

      {profileEditorOpen && (
        <ProfileEditor
          currentPicture={ownPicture}
          nodeNetworks={nodeNetworks}
          session={session}
          onClose={() => setProfileEditorOpen(false)}
          onUpdated={(nextSession) => {
            onSessionUpdated(nextSession);
            setProfileEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}

function isGroupConversation(conversation: ConversationResource): boolean {
  return conversation.type === 'group' || conversation.id.startsWith('group:');
}

function conversationParticipants(
  conversation: ConversationResource,
): string[] {
  return (
    conversation.participantIdentityIds ??
    conversation.participantIds ??
    conversation.participants ??
    []
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
  currentPicture,
  nodeNetworks,
  onClose,
  onUpdated,
  session,
}: {
  currentPicture?: string | null;
  nodeNetworks: NodeNetwork[];
  session: Session;
  onClose: () => void;
  onUpdated: (session: Session) => void;
}) {
  const [name, setName] = useState(session.identity.profile.name);
  const [handle, setHandle] = useState(session.identity.profile.handle ?? '');
  const [biography, setBiography] = useState(
    session.identity.profile.biography ?? '',
  );
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false);
  const [identityNetworkIds, setIdentityNetworkIds] = useState(
    session.identity.networks,
  );
  const [networkToAdd, setNetworkToAdd] = useState('');
  const [picturePreview, setPicturePreview] = useState(
    currentPicture ??
      (session.identity.profile.picture
        ? profilePictureUrl(session.identity.profile.picture)
        : null),
  );
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [imageEditor, setImageEditor] = useState<{
    file: File;
    shape: 'avatar' | 'banner';
  } | null>(null);
  const pictureInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const normalizedHandle = handle.trim() ? normalizeHandle(handle) : undefined;
  const wantsPasswordChange =
    newPassword.length > 0 || newPasswordConfirmation.length > 0;
  const passwordChecks = passwordValidationChecks(newPassword);
  const passwordsMatch =
    newPassword.length > 0 && newPassword === newPasswordConfirmation;
  const canChangePassword =
    !wantsPasswordChange || (isValidPassword(newPassword) && passwordsMatch);
  const canSubmit =
    name.trim().length > 0 &&
    identityNetworkIds.length > 0 &&
    (!normalizedHandle || isValidHandle(normalizedHandle)) &&
    canChangePassword &&
    state !== 'loading';
  const nodeNetworkOptions = useMemo(
    () =>
      nodeNetworks
        .filter((network) => !identityNetworkIds.includes(network.id))
        .map((network) => ({ label: network.name, value: network.id })),
    [identityNetworkIds, nodeNetworks],
  );
  const networkNamesById = useMemo(
    () => new Map(nodeNetworks.map((network) => [network.id, network.name])),
    [nodeNetworks],
  );

  useEffect(() => {
    if (nodeNetworkOptions.some((option) => option.value === networkToAdd)) {
      return;
    }

    setNetworkToAdd(nodeNetworkOptions[0]?.value ?? '');
  }, [networkToAdd, nodeNetworkOptions]);

  useEffect(() => {
    const banner = session.identity.profile.banner?.trim();

    if (!banner) {
      setBannerPreview(null);

      return;
    }

    const directBanner = profilePictureUrl(banner);

    if (directBanner) {
      setBannerPreview(directBanner);

      return;
    }

    let active = true;

    void pigeonApplication
      .getPublicFile(banner)
      .then((content) => {
        if (active) setBannerPreview(profilePictureDataUrl(content));
      })
      .catch(() => {
        if (active) setBannerPreview(null);
      });

    return () => {
      active = false;
    };
  }, [session.identity.profile.banner]);

  const addNetwork = () => {
    if (!networkToAdd || identityNetworkIds.includes(networkToAdd)) return;

    setIdentityNetworkIds((networkIds) => [...networkIds, networkToAdd]);
  };

  const handlePictureChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) setImageEditor({ file, shape: 'avatar' });
    event.target.value = '';
  };

  const handleBannerChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) setImageEditor({ file, shape: 'banner' });
    event.target.value = '';
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canSubmit) return;

    setState('loading');
    setError(null);
    try {
      const pictureCid = pictureFile
        ? (await pigeonApplication.uploadPublicFile(session, pictureFile)).cid
        : session.identity.profile.picture?.trim() || undefined;
      const bannerCid = bannerFile
        ? (await pigeonApplication.uploadPublicFile(session, bannerFile)).cid
        : session.identity.profile.banner?.trim() || undefined;
      const identity = await pigeonApplication.updateIdentityProfile(
        session,
        {
          banner: bannerCid,
          biography: biography.trim() || undefined,
          handle: normalizedHandle,
          name: name.trim(),
          networks: identityNetworkIds,
          picture: pictureCid,
        },
        wantsPasswordChange ? newPassword : undefined,
      );

      onUpdated({
        ...session,
        identity,
        password: wantsPasswordChange ? newPassword : session.password,
      });
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.profile.updateError));
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
        className="glass-panel-strong relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 shadow-2xl shadow-black/35 sm:max-w-5xl sm:p-6"
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

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
          <div className="overflow-hidden rounded-2xl bg-black/25">
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="group relative block aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-slate-900 via-fuchsia-950 to-cyan-900"
              aria-label={copy.profile.changeBanner}
            >
              {bannerPreview && (
                <img
                  src={bannerPreview}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/0 text-3xl opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                ✎
              </span>
            </button>
            <div className="relative px-4 pb-4">
              <button
                type="button"
                onClick={() => pictureInputRef.current?.click()}
                className="group relative -mt-9 grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-4 border-[#1f1f27] bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 shadow-xl shadow-black/35"
                aria-label={copy.profile.changePicture}
              >
                {picturePreview ? (
                  <img
                    src={picturePreview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (name || session.identity.id).slice(0, 1).toUpperCase()
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/0 text-2xl text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                  ✎
                </span>
              </button>
              <div className="mt-4 grid gap-3">
                <input
                  aria-label={copy.profile.name}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={ProfileName.MAX_LENGTH}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-lg font-black text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                />
                <input
                  aria-label={copy.profile.handle}
                  value={handle}
                  onChange={(event) =>
                    setHandle(normalizeHandle(event.target.value))
                  }
                  maxLength={ProfileHandle.MAX_LENGTH}
                  placeholder="@ada"
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold text-white/70 outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                />
                <textarea
                  aria-label={copy.profile.biography}
                  value={biography}
                  onChange={(event) => setBiography(event.target.value)}
                  maxLength={ProfileBiography.MAX_LENGTH}
                  className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                />
              </div>
            </div>
            <input
              ref={pictureInputRef}
              type="file"
              accept="image/*"
              onChange={handlePictureChange}
              className="sr-only"
            />
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerChange}
              className="sr-only"
            />
          </div>
          <div className="grid gap-4">
            <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-black text-white/70">
                {copy.profile.networks}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {identityNetworkIds.length > 0 ? (
                  identityNetworkIds.map((networkId) => (
                    <span
                      key={networkId}
                      title={networkId}
                      className="min-w-0 max-w-full truncate rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white/70"
                    >
                      {networkNamesById.get(networkId) ?? shortId(networkId)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-bold text-white/40">
                    {copy.profile.noNetworks}
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <GlassSelect
                  ariaLabel={copy.profile.availableNetwork}
                  className="min-w-0 flex-1"
                  disabled={nodeNetworkOptions.length === 0}
                  onChange={setNetworkToAdd}
                  options={
                    nodeNetworkOptions.length > 0
                      ? nodeNetworkOptions
                      : [
                          {
                            disabled: true,
                            label: copy.profile.noAvailableNetworks,
                            value: '',
                          },
                        ]
                  }
                  value={networkToAdd}
                />
                <button
                  type="button"
                  onClick={addNetwork}
                  disabled={!networkToAdd || nodeNetworkOptions.length === 0}
                  className="shrink-0 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {copy.profile.addNetwork}
                </button>
              </div>
            </section>
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <button
                type="button"
                onClick={() => setPasswordSectionOpen((isOpen) => !isOpen)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-black text-white/75 transition hover:bg-white/5"
                aria-expanded={passwordSectionOpen}
              >
                <span>{copy.profile.changePassword}</span>
                <span
                  aria-hidden="true"
                  className={cx(
                    'text-white/45 transition-transform',
                    passwordSectionOpen && 'rotate-180',
                  )}
                >
                  ⌄
                </span>
              </button>
              {passwordSectionOpen && (
                <div className="border-t border-white/10 p-4">
                  <p className="text-xs font-bold text-white/45">
                    {copy.profile.newPasswordHelp}
                  </p>
                  <div className="mt-4 grid gap-3">
                    <ProfileInput
                      label={copy.profile.newPassword}
                      value={newPassword}
                      onChange={setNewPassword}
                      placeholder="••••••••••••"
                      type="password"
                    />
                    <ProfileInput
                      label={copy.profile.newPasswordConfirm}
                      value={newPasswordConfirmation}
                      onChange={setNewPasswordConfirmation}
                      placeholder="••••••••••••"
                      type="password"
                    />
                  </div>
                  <PasswordChecklist
                    checks={{
                      ...passwordChecks,
                      match: passwordsMatch,
                    }}
                  />
                </div>
              )}
            </section>
          </div>
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
      {imageEditor && (
        <ImageCropEditor
          file={imageEditor.file}
          shape={imageEditor.shape}
          onClose={() => setImageEditor(null)}
          onApply={(file, previewUrl) => {
            if (imageEditor.shape === 'avatar') {
              setPictureFile(file);
              setPicturePreview(previewUrl);
            } else {
              setBannerFile(file);
              setBannerPreview(previewUrl);
            }
          }}
        />
      )}
    </div>,
    document.body,
  );
}

function ProfileInput({
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-white/70">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
      />
    </label>
  );
}

function PasswordChecklist({
  checks,
}: {
  checks: {
    lowercase: boolean;
    match: boolean;
    maxLength: boolean;
    minLength: boolean;
    number: boolean;
    symbol: boolean;
    uppercase: boolean;
  };
}) {
  const items = [
    [copy.profile.passwordRequirements.minLength, checks.minLength],
    [copy.profile.passwordRequirements.maxLength, checks.maxLength],
    [copy.profile.passwordRequirements.uppercase, checks.uppercase],
    [copy.profile.passwordRequirements.lowercase, checks.lowercase],
    [copy.profile.passwordRequirements.number, checks.number],
    [copy.profile.passwordRequirements.symbol, checks.symbol],
    [copy.profile.passwordRequirements.match, checks.match],
  ] as const;

  return (
    <div className="mt-4 grid grid-cols-1 gap-2 text-xs font-black sm:grid-cols-2">
      {items.map(([label, complete]) => (
        <div
          key={label}
          className={cx(
            'flex items-center gap-2 rounded-2xl px-3 py-2',
            complete
              ? 'bg-emerald-400/10 text-emerald-200'
              : 'bg-white/5 text-white/45',
          )}
        >
          <span aria-hidden="true">{complete ? '✓' : '×'}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
