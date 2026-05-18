import type { IdentityPresence, PresenceStatus } from '../../domain/types';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';

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
  const status = presence?.status ?? 'disconnected';
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

export function PresenceCustomStatus({
  className,
  presence,
}: {
  className?: string;
  presence?: IdentityPresence;
}) {
  const customMessage = presence?.customMessage?.trim();

  if (!customMessage) return null;

  return (
    <div
      className={cx(
        'mt-1 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-white/65',
        className,
      )}
    >
      <PresenceStatusDot
        inline
        presence={presence}
        size="sm"
        className="shrink-0 border-white/10"
      />
      <span className="truncate">{customMessage}</span>
    </div>
  );
}

export function presenceLabel(presence?: IdentityPresence): string {
  const status = presence?.status ?? 'disconnected';
  const statusLabel = copy.presence.statuses[status];
  const customMessage = presence?.customMessage?.trim();

  return customMessage ? `${statusLabel}: ${customMessage}` : statusLabel;
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
