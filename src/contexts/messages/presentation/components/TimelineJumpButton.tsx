import type { ReactNode } from 'react';

import { cx } from '../../../../shared/presentation/cx';

type TimelineJumpButtonProps = {
  children: ReactNode;
  mode: 'absolute' | 'sticky';
  onClick: () => void;
};

export function TimelineJumpButton({
  children,
  mode,
  onClick,
}: TimelineJumpButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'left-1/2 z-20 -translate-x-1/2 rounded-full bg-fuchsia-500 px-4 py-2 text-xs font-black text-white shadow-xl shadow-fuchsia-950/30 transition hover:bg-fuchsia-400',
        mode === 'absolute'
          ? 'absolute bottom-4'
          : 'sticky bottom-3 mt-3',
      )}
    >
      {children}
    </button>
  );
}
