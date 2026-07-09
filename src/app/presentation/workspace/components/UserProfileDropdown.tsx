import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { NodeNetwork } from '../../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import type { CallSession } from '../../../../contexts/calls/domain/callSession.types';
import type {
  Community,
  ConversationResource,
  IdentityResource,
  IdentityPresence,
  SelectablePresenceStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  getInitialLanguage,
  languageOptions,
  saveLanguage,
  type AppLanguage,
} from '../../../../shared/presentation/i18n/language';
import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import {
  identityDisplayName,
  identityPicture,
  type IdentityNames,
  type IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { FallbackImage } from '../../../../shared/presentation/components/FallbackImage';
import { GlassSelect } from '../../../../shared/presentation/components/glassSelect';
import { PresenceStatusDot } from '../../../../contexts/identities/presentation/components/presenceStatusDot';
import { useCloseOnOutsidePointerDown } from '../../../../shared/presentation/hooks/useCloseOnOutsidePointerDown';
import { ipfsUrl } from '../../../../shared/presentation/ipfsLinks';

const GlobalCallBar = lazy(() =>
  import('../../../../contexts/calls/presentation/components/GlobalCallBar').then(
    (module) => ({
      default: module.GlobalCallBar,
    }),
  ),
);
const ProfileEditor = lazy(() =>
  import('./ProfileEditor').then((module) => ({
    default: module.ProfileEditor,
  })),
);

export const UserProfileDropdown = memo(function UserProfileDropdown({
  activeCall,
  communities = [],
  conversations = [],
  identityNames = {},
  identityPictures = {},
  identityProfiles = {},
  nodeNetworks,
  onCallEnd,
  onCallParticipantScreenShareVolumeChange,
  onCallParticipantVolumeChange,
  onCallScreenShareQualityChange,
  onCallToggleCamera,
  onCallToggleDeafen,
  onCallToggleMute,
  onCallToggleNoiseCancellation,
  onCallRetryMicrophone,
  onCallToggleScreenShare,
  onLogout,
  onPresenceChange,
  onPresenceStatusSelected,
  onSessionUpdated,
  presence,
  session,
}: {
  communities?: Community[];
  conversations?: ConversationResource[];
  identityNames?: IdentityNames;
  identityPictures?: IdentityPictures;
  identityProfiles?: Record<string, IdentityResource>;
  nodeNetworks: NodeNetwork[];
  onLogout: () => void;
  onPresenceChange?: (presence: IdentityPresence) => void;
  onPresenceStatusSelected?: (status: SelectablePresenceStatus) => void;
  onSessionUpdated: (session: Session) => void;
  presence?: IdentityPresence;
  session: Session;
  activeCall?: CallSession | null;
  onCallEnd?: () => void;
  onCallParticipantVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallParticipantScreenShareVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallScreenShareQualityChange?: (
    quality: CallSession['screenShareQuality'],
  ) => void;
  onCallToggleCamera?: () => void;
  onCallToggleDeafen?: () => void;
  onCallToggleMute?: () => void;
  onCallToggleNoiseCancellation?: () => void;
  onCallRetryMicrophone?: () => void;
  onCallToggleScreenShare?: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [identityCopied, setIdentityCopied] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>(getInitialLanguage);
  const [presenceStatus, setPresenceStatus] =
    useState<SelectablePresenceStatus>(selectablePresenceStatus(presence));
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const [presenceSaving, setPresenceSaving] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const closeProfile = useCallback(() => setProfileOpen(false), []);
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

  const copyIdentityId = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(session.identity.id);
    }

    setIdentityCopied(true);
    window.setTimeout(() => setIdentityCopied(false), 1800);
  };

  const changeLanguage = (nextLanguage: string) => {
    const savedLanguage = saveLanguage(nextLanguage);

    setLanguage(savedLanguage);
    if (savedLanguage !== language) window.location.reload();
  };

  useEffect(() => {
    if (!presence) return;

    setPresenceStatus(selectablePresenceStatus(presence));
  }, [presence]);

  const updatePresenceStatus = async (nextStatus: string) => {
    const status = nextStatus as SelectablePresenceStatus;

    setPresenceStatus(status);
    setPresenceSaving(true);
    setPresenceError(null);
    onPresenceStatusSelected?.(status);
    try {
      const nextPresence = await applicationContainer.updatePresence(session, {
        status,
      });

      onPresenceChange?.(nextPresence);
    } catch {
      setPresenceError(copy.presence.error);
      setPresenceStatus(selectablePresenceStatus(presence));
      if (presence)
        onPresenceStatusSelected?.(selectablePresenceStatus(presence));
    } finally {
      setPresenceSaving(false);
    }
  };

  useCloseOnOutsidePointerDown({
    active: profileOpen,
    onClose: closeProfile,
    ref: profileRef,
  });

  return (
    <div ref={profileRef} className="relative mt-4 shrink-0">
      {activeCall &&
        onCallEnd &&
        onCallParticipantScreenShareVolumeChange &&
        onCallParticipantVolumeChange &&
        onCallScreenShareQualityChange &&
        onCallToggleCamera &&
        onCallToggleDeafen &&
        onCallToggleMute &&
        onCallToggleNoiseCancellation &&
        onCallRetryMicrophone &&
        onCallToggleScreenShare && (
          <div className="absolute bottom-[calc(100%+.5rem)] left-0 right-0 z-30">
            <Suspense fallback={null}>
              <GlobalCallBar
                call={activeCall}
                onEnd={onCallEnd}
                onParticipantScreenShareVolumeChange={
                  onCallParticipantScreenShareVolumeChange
                }
                onParticipantVolumeChange={onCallParticipantVolumeChange}
                onScreenShareQualityChange={onCallScreenShareQualityChange}
                onToggleCamera={onCallToggleCamera}
                onToggleDeafen={onCallToggleDeafen}
                onToggleMute={onCallToggleMute}
                onToggleNoiseCancellation={onCallToggleNoiseCancellation}
                onRetryMicrophone={onCallRetryMicrophone}
                onToggleScreenShare={onCallToggleScreenShare}
              />
            </Suspense>
          </div>
        )}
      <button
        type="button"
        onClick={() => setProfileOpen((isOpen) => !isOpen)}
        className="flex w-full items-center gap-3 rounded-lg bg-white/[0.07] p-3 text-left transition hover:bg-white/10"
        aria-expanded={profileOpen}
        data-testid="own-profile-menu-button"
      >
        <ProfileAvatar
          label={ownDisplayName}
          picture={ownPicture}
          presence={presence}
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
        <div
          className={cx(
            'ui-dialog-surface absolute left-0 right-0 z-40 p-3',
            activeCall
              ? 'bottom-[calc(100%+5.75rem)]'
              : 'bottom-[calc(100%+.5rem)]',
          )}
        >
          <div className="space-y-3 text-xs">
            <div>
              <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
                {copy.presence.status}
              </div>
              <GlassSelect
                ariaLabel={copy.presence.selectStatus}
                disabled={presenceSaving}
                onChange={(value) => void updatePresenceStatus(value)}
                options={presenceStatusOptions()}
                value={presenceStatus}
              />
            </div>

            {presenceError && (
              <p className="ui-inline-notice border-rose-300/50 bg-rose-500/10 text-rose-100">
                {presenceError}
              </p>
            )}

            <div>
              <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
                {copy.profile.identityId}
              </div>
              <div className="ui-list-row py-2">
                <span className="min-w-0 flex-1 truncate text-white/70">
                  {session.identity.id}
                </span>
                <button
                  type="button"
                  onClick={copyIdentityId}
                  className="ui-button min-h-0 shrink-0 px-2.5 py-1.5 text-xs"
                >
                  {identityCopied ? copy.profile.copied : copy.profile.copy}
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
                {copy.profile.versions}
              </div>
              <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
                <ProfileVersionRow
                  href={
                    session.identity.identityExternalIdentifier
                      ? ipfsUrl(session.identity.identityExternalIdentifier)
                      : undefined
                  }
                  label={copy.profile.identityVersion}
                  value={formatProfileVersion(session.identity.version)}
                  detail={formatProfileVersionDate(session.identity.timestamp)}
                />
                <ProfileVersionRow
                  href={
                    session.keychainExternalIdentifier
                      ? ipfsUrl(session.keychainExternalIdentifier)
                      : undefined
                  }
                  label={copy.profile.keychainVersion}
                  value={formatProfileVersion(session.keychain.version)}
                  detail={formatProfileVersionDate(session.keychain.timestamp)}
                />
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
            className="ui-button mt-4 w-full"
            data-testid="edit-profile-button"
          >
            {copy.profile.edit}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="ui-button ui-button-danger mt-2 w-full"
          >
            {copy.profile.logout}
          </button>
        </div>
      )}

      {profileEditorOpen && (
        <Suspense fallback={null}>
          <ProfileEditor
            communities={communities}
            conversations={conversations}
            currentPicture={ownPicture}
            identityNames={identityNames}
            identityProfiles={identityProfiles}
            nodeNetworks={nodeNetworks}
            session={session}
            onClose={() => setProfileEditorOpen(false)}
            onUpdated={(nextSession, change) => {
              setProfileEditorOpen(false);
              if (change.passwordChanged) {
                onLogout();

                return;
              }

              onSessionUpdated(nextSession);
            }}
          />
        </Suspense>
      )}
    </div>
  );
});

function ProfileVersionRow({
  detail,
  href,
  label,
  value,
}: {
  detail?: string;
  href?: string;
  label: string;
  value: string;
}) {
  const content = (
    <>
      <div className="min-w-0">
        <div className="truncate font-black text-white/70">{label}</div>
        {detail ? (
          <div className="truncate text-[0.68rem] font-bold text-white/35">
            {detail}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 font-black text-white/55">{value}</div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-3 px-1 py-2 transition hover:bg-white/5"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-1 py-2">
      {content}
    </div>
  );
}

function formatProfileVersion(version: number): string {
  return Number.isFinite(version) ? `v${version}` : '-';
}

function formatProfileVersionDate(timestamp?: number): string | undefined {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return undefined;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function ProfileAvatar({
  className,
  label,
  picture,
  presence,
  size = 'md',
}: {
  className?: string;
  label: string;
  picture?: string | null;
  presence?: IdentityPresence;
  size?: 'lg' | 'md' | 'xl';
}) {
  return (
    <div
      className={cx(
        'relative grid shrink-0 place-items-center overflow-visible rounded-lg bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950',
        size === 'xl'
          ? 'h-16 w-16 text-2xl'
          : size === 'lg'
            ? 'h-12 w-12 text-lg'
            : 'h-11 w-11 text-base',
        className,
      )}
    >
      <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-lg">
        <FallbackImage
          src={picture}
          alt=""
          className="h-full w-full object-cover"
          fallback={label.slice(0, 1).toUpperCase() || 'P'}
        />
      </span>
      <PresenceStatusDot
        presence={presence}
        size={size === 'xl' ? 'lg' : 'md'}
        className="-bottom-1 -right-1"
      />
    </div>
  );
}

function presenceStatusOptions(): Array<{
  indicatorClassName: string;
  label: string;
  value: SelectablePresenceStatus;
}> {
  return [
    {
      indicatorClassName: 'bg-emerald-400',
      label: copy.presence.statuses.available,
      value: 'available',
    },
    {
      indicatorClassName: 'bg-amber-400',
      label: copy.presence.statuses.away,
      value: 'away',
    },
    {
      indicatorClassName: 'bg-rose-500',
      label: copy.presence.statuses.busy,
      value: 'busy',
    },
    {
      indicatorClassName: 'bg-zinc-500',
      label: copy.presence.statuses.invisible,
      value: 'invisible',
    },
  ];
}

function selectablePresenceStatus(
  presence?: IdentityPresence,
): SelectablePresenceStatus {
  if (!presence || presence.status === 'disconnected') return 'available';

  return presence.status;
}
