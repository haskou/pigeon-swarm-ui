import { useEffect, useState } from 'react';

const DESKTOP_INPUT_FOCUS_QUERY = '(hover: hover) and (pointer: fine)';

export function useDesktopInputFocus(): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;

    return window.matchMedia(DESKTOP_INPUT_FOCUS_QUERY).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_INPUT_FOCUS_QUERY);
    const update = () => setMatches(media.matches);

    update();
    media.addEventListener('change', update);

    return () => media.removeEventListener('change', update);
  }, []);

  return matches;
}
