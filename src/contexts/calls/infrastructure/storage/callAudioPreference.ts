import {
  readJsonObjectFromLocalStorage,
  writeJsonToLocalStorage,
} from '../../../../shared/infrastructure/storage/jsonLocalStorage';

type CallAudioPreference = {
  noiseCancellationEnabled?: boolean;
};

const callAudioStorageKey = (identityId: string): string =>
  `pigeon:callAudio:${identityId}`;

export function loadCallNoiseCancellationEnabled(identityId: string): boolean {
  const preference = readJsonObjectFromLocalStorage<CallAudioPreference>(
    callAudioStorageKey(identityId),
    {},
  );

  return preference.noiseCancellationEnabled ?? true;
}

export function saveCallNoiseCancellationEnabled(
  identityId: string,
  enabled: boolean,
): void {
  writeJsonToLocalStorage(callAudioStorageKey(identityId), {
    noiseCancellationEnabled: enabled,
  });
}
