import type { MouseEvent } from 'react';

import type { IdentityPresence } from '../../domain/types';

import { cx } from '../../utils/classNameHelper';
import { PresenceStatusDot } from '../presence/PresenceStatusDot';

interface AvatarProps {
  label: string;
  mine?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  picture?: string | null;
  presence?: IdentityPresence;
}

export function Avatar({
  label,
  mine,
  onClick,
  picture,
  presence,
}: AvatarProps) {
  const className = cx(
    'relative mt-1 grid h-10 w-10 shrink-0 place-items-center overflow-visible rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-sm font-black text-slate-950',
    mine && 'ring-2 ring-white/40',
  );

  const content = picture ? (
    <img src={picture} alt="" className="h-full w-full object-cover" />
  ) : (
    label.slice(0, 1).toUpperCase()
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl">
          {content}
        </span>
        <PresenceStatusDot
          presence={presence}
          className="-bottom-1 -right-1 border-[#111226]"
        />
      </button>
    );
  }

  return (
    <div className={className}>
      <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl">
        {content}
      </span>
      <PresenceStatusDot
        presence={presence}
        className="-bottom-1 -right-1 border-[#111226]"
      />
    </div>
  );
}
