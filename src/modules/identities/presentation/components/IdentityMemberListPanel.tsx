import type { MouseEvent, ReactNode } from 'react';

import type {
  IdentityPresence,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { cx } from '../../../../shared/presentation/cx';
import { FallbackImage } from '../../../../shared/presentation/components/FallbackImage';
import { SectionTitle } from '../../../../shared/presentation/components/SectionTitle';
import { shortId } from '../../../../shared/presentation/formatting';
import { PresenceStatusDot } from './presenceStatusDot';

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
  count,
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
  count?: number;
  emptyLabel: string;
  items: IdentityMemberListItem[];
  listClassName?: string;
  onItemClick: (
    item: IdentityMemberListItem,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  ownerLabel?: string;
  title: string;
}) {
  return (
    <div className={cx('flex min-h-0 flex-col', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <SectionTitle title={title} />
          <span className="rounded-full bg-white/8 px-2.5 py-1 text-[0.68rem] font-black text-white/45">
            {count ?? items.length}
          </span>
        </div>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
        >
          {action.label}
        </button>
      )}
      <div
        className={cx('mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1', listClassName)}
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

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-white/8 p-3 text-left transition hover:bg-white/12"
    >
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
