import type { MouseEvent, ReactNode } from 'react';

import { useEffect, useState } from 'react';

import type {
  IdentityPresence,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { cx } from '../../../../shared/presentation/cx';
import { FallbackImage } from '../../../../shared/presentation/components/FallbackImage';
import { shortId } from '../../../../shared/presentation/formatting';
import {
  identityBanner,
  publicFileObjectUrl,
} from '../view-models/identityDisplay';
import { PresenceStatusDot } from './presenceStatusDot';
import { applicationContainer } from '../../../../app/composition/applicationContainer';

export type IdentityMemberListItem = {
  identity?: IdentityResource;
  identityId: string;
  name?: string;
  owner?: boolean;
  pictureUrl: null | string;
  presence?: IdentityPresence;
};

export function IdentityMemberListPanel({
  action,
  className,
  emptyLabel,
  items,
  listClassName,
  onItemClick,
  ownerLabel,
  title,
}: {
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  emptyLabel: string;
  items: IdentityMemberListItem[];
  listClassName?: string;
  onItemClick: (
    item: IdentityMemberListItem,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  ownerLabel?: string;
  title?: string;
}) {
  return (
    <div className={cx('flex min-h-0 flex-col', className)}>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
        >
          {action.label}
        </button>
      )}
      <div
        className={cx(
          'min-h-0 flex-1 space-y-2 overflow-y-auto pr-1',
          action && 'mt-4',
          listClassName,
        )}
      >
        {items.map((item) => (
          <IdentityMemberRow
            item={item}
            key={item.identityId}
            onClick={(event) => onItemClick(item, event)}
            ownerLabel={ownerLabel}
          />
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl bg-white/8 p-4 text-sm font-semibold text-white/45">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function IdentityMemberRow({
  item,
  onClick,
  ownerLabel,
}: {
  item: IdentityMemberListItem;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  ownerLabel?: string;
}) {
  const displayName = item.name ?? memberName(item.identity, item.identityId);
  const handle = item.identity?.profile.handle?.trim();
  const bannerUrl = useIdentityBannerUrl(item.identity);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-white/8 p-3 text-left transition hover:bg-white/12"
    >
      {bannerUrl && (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(6,8,26,0) 0%, rgba(6,8,26,0) 50%, rgba(6,8,26,.62) 100%), url(${bannerUrl})`,
            maskImage:
              'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 56%, rgba(0,0,0,.55) 72%, black 100%)',
            WebkitMaskImage:
              'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 56%, rgba(0,0,0,.55) 72%, black 100%)',
          }}
        />
      )}
      <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-visible rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
        <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl">
          <FallbackImage
            src={item.pictureUrl}
            alt=""
            className="h-full w-full object-cover"
            fallback={displayName.slice(0, 1).toUpperCase()}
          />
        </span>
        <PresenceStatusDot presence={item.presence} className="-bottom-1 -right-1" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black">{displayName}</div>
        <div className="truncate text-xs text-white/45">
          {handle ? `@${handle}` : shortId(item.identityId)}
        </div>
      </div>
      {item.owner && ownerLabel && (
        <OwnerMarker label={ownerLabel}>♛</OwnerMarker>
      )}
    </button>
  );
}

function OwnerMarker({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <span className="shrink-0 text-sm text-yellow-300" title={label}>
      {children}
    </span>
  );
}

function memberName(
  identity: IdentityResource | undefined,
  identityId: string,
): string {
  const name = identity?.profile.name.trim();

  if (name) return name;

  const handle = identity?.profile.handle?.trim();

  return handle ? `@${handle}` : shortId(identityId);
}

function useIdentityBannerUrl(identity?: IdentityResource): string | null {
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!identity?.profile.banner) {
      setBannerUrl(null);

      return;
    }

    const directBanner = identityBanner(identity);

    if (directBanner) {
      setBannerUrl(directBanner);

      return;
    }

    let cancelled = false;
    const bannerCid = identity.profile.banner.trim();

    setBannerUrl(null);
    void applicationContainer
      .getPublicFile(bannerCid)
      .then((content) => {
        if (!cancelled) {
          setBannerUrl(publicFileObjectUrl(content));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [identity]);

  return bannerUrl;
}
