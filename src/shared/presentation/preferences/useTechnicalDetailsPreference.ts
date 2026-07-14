import { useSyncExternalStore } from 'react';

import { TechnicalDetailsPreference } from './TechnicalDetailsPreference';

export function useTechnicalDetailsPreference(): readonly [
  boolean,
  (enabled: boolean) => void,
] {
  const enabled = useSyncExternalStore(
    TechnicalDetailsPreference.subscribe,
    TechnicalDetailsPreference.enabled,
    () => false,
  );

  return [enabled, TechnicalDetailsPreference.update] as const;
}
