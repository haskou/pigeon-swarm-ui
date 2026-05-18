import type { SelectablePresenceStatus } from '../../domain/types';

const presencePreferenceStoragePrefix = 'pigeon:presencePreference:';

function presencePreferenceStorageKey(identityId: string): string {
  return `${presencePreferenceStoragePrefix}${identityId}`;
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
    // Local storage is best-effort; the server still receives the explicit status.
  }
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
