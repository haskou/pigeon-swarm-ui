import { useEffect, useRef } from 'react';

import { closeOnEscapeStack } from './CloseOnEscapeStack';

export function useCloseOnEscape(onClose: () => void, active = true): void {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return undefined;

    const token = closeOnEscapeStack.add();

    const closeTopmostOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;

      if (!closeOnEscapeStack.isTopmost(token)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onCloseRef.current();
    };

    window.addEventListener('keydown', closeTopmostOnEscape, true);

    return () => {
      closeOnEscapeStack.remove(token);
      window.removeEventListener('keydown', closeTopmostOnEscape, true);
    };
  }, [active]);
}
