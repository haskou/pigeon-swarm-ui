import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../../networks/application/list-node-networks/ListNodeNetworks';
import type {
  IdentityPresence,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { shortId } from '../../../../shared/presentation/formatting';
import {
  identityBanner,
  identityPicture,
  publicFileObjectUrl,
} from '../view-models/identityDisplay';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import {
  ImageLightbox,
  type LightboxImage,
} from '../../../messages/presentation/components/imageLightbox';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { PresenceStatusDot } from './presenceStatusDot';

type ProfilePopoverAnchor = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

interface UserProfileDialogProps {
  anchor?: ProfilePopoverAnchor;
  communityRoles?: string[];
  identity?: IdentityResource;
  identityId: string;
  name: string;
  nodeNetworks: NodeNetwork[];
  onClose: () => void;
  onOpenConversation?: () => Promise<void> | void;
  picture?: string | null;
  presence?: IdentityPresence;
}

export function UserProfileDialog({
  anchor,
  communityRoles,
  identity,
  identityId,
  name,
  nodeNetworks,
  onClose,
  onOpenConversation,
  picture,
  presence,
}: UserProfileDialogProps) {
  useCloseOnEscape(onClose);

  const [copied, setCopied] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(
    null,
  );
  const [conversationOpening, setConversationOpening] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[] | null>(
    null,
  );
  const profileName = identity?.profile.name.trim();
  const profileHandle = identity?.profile.handle?.trim();
  const displayName =
    profileName || (profileHandle ? `@${profileHandle}` : name);
  const displayHandle = profileHandle
    ? `@${profileHandle}`
    : shortId(identityId);
  const displayPicture =
    (identity ? identityPicture(identity) : null) ?? picture;
  const directBanner = identity ? identityBanner(identity) : null;
  const biography =
    identity?.profile.biography?.trim() || copy.profile.noBiography;
  const networks = identity?.networks ?? [];
  const networkNames = networks.map(
    (networkId) =>
      nodeNetworks.find((network) => network.id === networkId)?.name ??
      shortId(networkId),
  );
  const position = useMemo(() => profilePopoverPosition(anchor), [anchor]);

  useEffect(() => {
    if (directBanner) {
      setBannerUrl(directBanner);

      return;
    }

    const bannerCid = identity?.profile.banner?.trim();

    if (!bannerCid) {
      setBannerUrl(null);

      return;
    }

    let active = true;

    void applicationContainer
      .getPublicFile(bannerCid)
      .then((content) => {
        if (active) setBannerUrl(publicFileObjectUrl(content));
      })
      .catch(() => {
        if (active) setBannerUrl(null);
      });

    return () => {
      active = false;
    };
  }, [directBanner, identity?.profile.banner]);

  const copyIdentityId = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(identityId);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const openConversation = async () => {
    if (!onOpenConversation || conversationOpening) return;

    setConversationOpening(true);
    setConversationError(null);

    try {
      await onOpenConversation();
      onClose();
    } catch (caught) {
      setConversationError(
        toUserErrorMessage(caught, copy.dialog.createConversationError),
      );
    } finally {
      setConversationOpening(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section
        className="glass-panel-strong fixed z-10 w-[min(22.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-0 shadow-2xl shadow-black/50"
        style={{ left: position.left, top: position.top }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative h-28 overflow-hidden bg-gradient-to-br from-slate-900 via-fuchsia-950 to-cyan-900">
          {bannerUrl && (
            <button
              type="button"
              onClick={() =>
                setLightboxImages([
                  {
                    alt: displayName,
                    filename: `${displayName} banner`,
                    url: bannerUrl,
                  },
                ])
              }
              className="h-full w-full cursor-zoom-in"
              aria-label={copy.profile.openBanner}
            >
              <img
                src={bannerUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/45 text-xl font-black text-white/80 backdrop-blur transition hover:bg-black/65"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </div>

        <div className="relative px-5 pb-5">
          <button
            type="button"
            onClick={() => {
              if (!displayPicture) return;

              setLightboxImages([
                {
                  alt: displayName,
                  filename: `${displayName} avatar`,
                  url: displayPicture,
                },
              ]);
            }}
            disabled={!displayPicture}
            className="relative -mt-10 grid h-20 w-20 place-items-center overflow-visible rounded-2xl border-4 border-[#1f1f27] bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 shadow-xl shadow-black/35 transition enabled:cursor-zoom-in enabled:hover:brightness-110 disabled:cursor-default"
            aria-label={copy.profile.openPicture}
          >
            <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-xl">
              {displayPicture ? (
                <img
                  src={displayPicture}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </span>
            <PresenceStatusDot
              presence={presence}
              size="lg"
              className="-bottom-1 -right-1"
            />
          </button>

          <div className="mt-3 flex min-w-0 items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-black">{displayName}</h2>
              <p className="truncate text-sm text-white/45">{displayHandle}</p>
            </div>
            {onOpenConversation && (
              <button
                type="button"
                onClick={() => void openConversation()}
                disabled={conversationOpening}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-white transition hover:bg-fuchsia-500 disabled:cursor-wait disabled:opacity-60"
                aria-label={copy.profile.openConversation}
                title={copy.profile.openConversation}
              >
                <ConversationIcon />
              </button>
            )}
          </div>

          {conversationError && (
            <p className="mt-3 rounded-2xl border border-rose-200/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-100">
              {conversationError}
            </p>
          )}

          <p className="mt-4 max-h-28 overflow-y-auto text-sm leading-6 text-white/70">
            {biography}
          </p>

          <div className="mt-3 grid gap-3 text-xs">
            <div className="min-w-0">
              <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
                {copy.profile.identityId}
              </div>
              <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-black/25 p-2">
                <span className="block min-w-0 flex-1 truncate text-white/70">
                  {identityId}
                </span>
                <button
                  type="button"
                  onClick={copyIdentityId}
                  className="shrink-0 rounded-2xl bg-white px-2.5 py-1.5 font-black text-slate-950"
                >
                  {copied ? copy.profile.copied : copy.profile.copy}
                </button>
              </div>
            </div>
            <ProfileField
              label={copy.profile.networks}
              value={
                networkNames.length > 0
                  ? networkNames.join(', ')
                  : copy.profile.noNetworks
              }
            />
            {communityRoles && (
              <ProfileRoleField
                label={copy.profile.communityRoles}
                roles={communityRoles}
              />
            )}
          </div>
        </div>
      </section>
      {lightboxImages && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={0}
          onClose={() => setLightboxImages(null)}
        />
      )}
    </div>,
    document.body,
  );
}

function profilePopoverPosition(anchor?: ProfilePopoverAnchor): {
  left: number;
  top: number;
} {
  const margin = 12;
  const gap = 10;
  const width = Math.min(360, window.innerWidth - margin * 2);
  const estimatedHeight = Math.min(520, window.innerHeight - margin * 2);

  if (!anchor) {
    return {
      left: Math.max(margin, (window.innerWidth - width) / 2),
      top: Math.max(margin, (window.innerHeight - estimatedHeight) / 2),
    };
  }

  const rightSpace = window.innerWidth - anchor.right;
  const leftSpace = anchor.left;
  const belowSpace = window.innerHeight - anchor.bottom;
  const topForSide = clamp(
    anchor.top + anchor.height / 2 - estimatedHeight / 2,
    margin,
    window.innerHeight - estimatedHeight - margin,
  );

  if (rightSpace >= width + gap + margin) {
    return { left: anchor.right + gap, top: topForSide };
  }

  if (leftSpace >= width + gap + margin) {
    return { left: anchor.left - width - gap, top: topForSide };
  }

  const centeredLeft = clamp(
    anchor.left + anchor.width / 2 - width / 2,
    margin,
    window.innerWidth - width - margin,
  );

  if (belowSpace >= estimatedHeight + gap + margin) {
    return { left: centeredLeft, top: anchor.bottom + gap };
  }

  return {
    left: centeredLeft,
    top: clamp(
      anchor.top - estimatedHeight - gap,
      margin,
      window.innerHeight - estimatedHeight - margin,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function ProfileField({ label, value }: { label: string; value: string }) {
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

function ProfileRoleField({
  label,
  roles,
}: {
  label: string;
  roles: string[];
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>
      <div className="flex max-h-24 min-w-0 flex-wrap gap-1.5 overflow-y-auto rounded-2xl bg-black/25 px-3 py-2 text-white/70">
        {roles.length > 0 ? (
          roles.map((role) => (
            <span
              key={role}
              className="min-w-0 max-w-full truncate rounded-full bg-white/10 px-2.5 py-1 font-black text-white/75"
            >
              {role}
            </span>
          ))
        ) : (
          <span>{copy.profile.noCommunityRoles}</span>
        )}
      </div>
    </div>
  );
}

function ConversationIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v5A3.5 3.5 0 0 1 15.5 15H11l-4.5 4v-4A3.5 3.5 0 0 1 3 11.5v-5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M8 8h8M8 11h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
