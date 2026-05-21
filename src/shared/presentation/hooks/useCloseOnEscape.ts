import { useEffect, useRef } from 'react';

const closeOnEscapeStack: symbol[] = [];

export function useCloseOnEscape(onClose: () => void, active = true): void {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return undefined;

    const token = Symbol('close-on-escape');
    closeOnEscapeStack.push(token);

    const closeTopmostOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;

      if (closeOnEscapeStack[closeOnEscapeStack.length - 1] !== token) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onCloseRef.current();
    };

    window.addEventListener('keydown', closeTopmostOnEscape, true);

    return () => {
      const index = closeOnEscapeStack.indexOf(token);
      if (index >= 0) closeOnEscapeStack.splice(index, 1);

      window.removeEventListener('keydown', closeTopmostOnEscape, true);
    };
  }, [active]);
}
