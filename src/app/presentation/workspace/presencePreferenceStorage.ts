import type { SelectablePresenceStatusResource as SelectablePresenceStatus } from '../../../contexts/identities/infrastructure/http/resources/SelectablePresenceStatusResource';

import { scopeClientStorageKey } from '../../../shared/infrastructure/storage/ClientStorageScope';

const presencePreferenceStoragePrefix = 'pigeon:presencePreference:';

function presencePreferenceStorageKey(identityId: string): string {
  return scopeClientStorageKey(
    `${presencePreferenceStoragePrefix}${identityId}`,
  );
}

function isSelectablePresenceStatus(
  value: unknown,
): value is SelectablePresenceStatus {
  return (
    value === 'available' ||
    value === 'away' ||
    value === 'busy' ||
    value === 'invisible'
  );
}

export function readPresencePreference(
  identityId: string,
): SelectablePresenceStatus | null {
  try {
    const value = globalThis.localStorage?.getItem(
      presencePreferenceStorageKey(identityId),
    );

    return isSelectablePresenceStatus(value) ? value : null;
  } catch {
    return null;
  }
}

export function writePresencePreference(
  identityId: string,
  status: SelectablePresenceStatus,
): void {
  try {
    globalThis.localStorage?.setItem(
      presencePreferenceStorageKey(identityId),
      status,
    );
  } catch {
    // The server still receives the status if local storage fails.
  }
}
