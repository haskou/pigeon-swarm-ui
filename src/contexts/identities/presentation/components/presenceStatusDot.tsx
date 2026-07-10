import type {
  IdentityPresence,
  PresenceStatus,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';

export function PresenceStatusDot({
  className,
  inline = false,
  presence,
  size = 'md',
}: {
  className?: string;
  inline?: boolean;
  presence?: IdentityPresence;
  size?: 'lg' | 'md' | 'sm';
}) {
  if (!presence) return null;

  const status = presence.status;
  const label = presenceLabel(presence);

  return (
    <span
      aria-label={label}
      className={cx(
        inline ? 'inline-block' : 'absolute',
        'rounded-full border-2 border-[#151724] shadow-sm shadow-black/30',
        size === 'lg' ? 'h-4 w-4' : size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5',
        statusClassName(status),
        className,
      )}
      title={label}
    />
  );
}

export function presenceLabel(presence?: IdentityPresence): string {
  const status = presence?.status ?? 'disconnected';

  return copy.presence.statuses[status];
}

function statusClassName(status: PresenceStatus): string {
  switch (status) {
    case 'available':
      return 'bg-emerald-400';
    case 'away':
      return 'bg-amber-400';
    case 'busy':
      return 'bg-rose-500';
    case 'disconnected':
    case 'invisible':
      return 'bg-zinc-500';
  }
}
