import type { RefObject } from 'react';

import { useEffect } from 'react';

export function useCloseOnOutsidePointerDown<T extends HTMLElement>({
  active,
  onClose,
  ref,
}: {
  active: boolean;
  onClose: () => void;
  ref: RefObject<T | null>;
}) {
  useEffect(() => {
    if (!active) return undefined;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof Node && ref.current?.contains(target)) {
        return;
      }

      onClose();
    };

    document.addEventListener('pointerdown', closeOnOutsidePointerDown);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
    };
  }, [active, onClose, ref]);
}
