import {
  readJsonObjectFromLocalStorage,
  writeJsonToLocalStorage,
} from '../../../../shared/infrastructure/storage/jsonLocalStorage';

type CallAudioPreference = {
  mediaEncryptionEnabled?: boolean;
  noiseCancellationEnabled?: boolean;
};

const callAudioStorageKey = (identityId: string): string =>
  `pigeon:callAudio:${identityId}`;

export function loadCallNoiseCancellationEnabled(identityId: string): boolean {
  const preference = loadCallAudioPreference(identityId);

  return preference.noiseCancellationEnabled ?? true;
}

export function loadCallMediaEncryptionEnabled(identityId: string): boolean {
  return loadCallAudioPreference(identityId).mediaEncryptionEnabled ?? true;
}

export function saveCallNoiseCancellationEnabled(
  identityId: string,
  enabled: boolean,
): void {
  saveCallAudioPreference(identityId, {
    noiseCancellationEnabled: enabled,
  });
}

export function saveCallMediaEncryptionEnabled(
  identityId: string,
  enabled: boolean,
): void {
  saveCallAudioPreference(identityId, {
    mediaEncryptionEnabled: enabled,
  });
}

function loadCallAudioPreference(identityId: string): CallAudioPreference {
  return readJsonObjectFromLocalStorage<CallAudioPreference>(
    callAudioStorageKey(identityId),
    {},
  );
}

function saveCallAudioPreference(
  identityId: string,
  preference: CallAudioPreference,
): void {
  writeJsonToLocalStorage(callAudioStorageKey(identityId), {
    ...loadCallAudioPreference(identityId),
    ...preference,
  });
}
