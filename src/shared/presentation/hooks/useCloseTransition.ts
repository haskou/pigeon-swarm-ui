import { useCallback, useEffect, useRef, useState } from 'react';

export type CloseTransitionState = 'closing' | 'open';

export function useCloseTransition(
  onClose: () => void,
  durationMs = 180,
): {
  close: () => void;
  state: CloseTransitionState;
} {
  const [state, setState] = useState<CloseTransitionState>('open');
  const timeoutRef = useRef<number | null>(null);

  const close = useCallback(() => {
    if (timeoutRef.current !== null) return;

    setState('closing');
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      onClose();
    }, durationMs);
  }, [durationMs, onClose]);

  useEffect(
    () => () => {
      if (timeoutRef.current === null) return;

      window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  return { close, state };
}
