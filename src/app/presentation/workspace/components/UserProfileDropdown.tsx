import { lazy, memo, Suspense, useEffect, useRef, useState } from 'react';

import type { NodeNetwork } from '../../../../modules/networks/application/list-node-networks/ListNodeNetworks';
import type { CallSession } from '../../../../modules/calls/domain/callSession.types';
import type {
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
} from '../../../../modules/identities/presentation/view-models/identityDisplay';
import { FallbackImage } from '../../../../shared/presentation/components/FallbackImage';
import { GlassSelect } from '../../../../shared/presentation/components/glassSelect';
import { PresenceStatusDot } from '../../../../modules/identities/presentation/components/presenceStatusDot';

const GlobalCallBar = lazy(() =>
  import('../../../../modules/calls/presentation/components/GlobalCallBar').then(
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
  identityNames = {},
  identityPictures = {},
  nodeNetworks,
  onCallEnd,
  onCallParticipantScreenShareVolumeChange,
  onCallParticipantVolumeChange,
  onCallToggleCamera,
  onCallToggleDeafen,
  onCallToggleMute,
  onCallToggleNoiseCancellation,
  onCallToggleScreenShareAudio,
  onCallToggleScreenShare,
  onLogout,
  onPresenceChange,
  onPresenceStatusSelected,
  onSessionUpdated,
  presence,
  session,
}: {
  identityNames?: IdentityNames;
  identityPictures?: IdentityPictures;
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
  onCallToggleCamera?: () => void;
  onCallToggleDeafen?: () => void;
  onCallToggleMute?: () => void;
  onCallToggleNoiseCancellation?: () => void;
  onCallToggleScreenShareAudio?: () => void;
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
    setLanguage(saveLanguage(nextLanguage));
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
        onCallParticipantScreenShareVolumeChange &&
        onCallParticipantVolumeChange &&
        onCallToggleCamera &&
        onCallToggleDeafen &&
        onCallToggleMute &&
        onCallToggleNoiseCancellation &&
        onCallToggleScreenShareAudio &&
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
                onToggleCamera={onCallToggleCamera}
                onToggleDeafen={onCallToggleDeafen}
                onToggleMute={onCallToggleMute}
                onToggleNoiseCancellation={onCallToggleNoiseCancellation}
                onToggleScreenShareAudio={onCallToggleScreenShareAudio}
                onToggleScreenShare={onCallToggleScreenShare}
              />
            </Suspense>
          </div>
        )}
      <button
        type="button"
        onClick={() => setProfileOpen((isOpen) => !isOpen)}
        className="flex w-full items-center gap-3 rounded-2xl bg-white/10 p-3 text-left transition hover:bg-white/14"
        aria-expanded={profileOpen}
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
            'absolute left-0 right-0 z-40 rounded-2xl border border-white/10 bg-[#0c102b]/95 p-3 shadow-2xl shadow-black/45 backdrop-blur-xl',
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
              <p className="rounded-2xl border border-rose-300/25 bg-rose-500/15 p-2 text-rose-100">
                {presenceError}
              </p>
            )}

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
        <Suspense fallback={null}>
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
        </Suspense>
      )}
    </div>
  );
});

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
        'relative grid shrink-0 place-items-center overflow-visible rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950',
        size === 'xl'
          ? 'h-16 w-16 text-2xl'
          : size === 'lg'
            ? 'h-12 w-12 text-lg'
            : 'h-11 w-11 text-base',
        className,
      )}
    >
      <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl">
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
