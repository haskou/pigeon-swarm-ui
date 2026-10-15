import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import {
  readJsonObjectFromLocalStorage,
  writeJsonToLocalStorage,
} from '../../../../shared/infrastructure/storage/jsonLocalStorage';

type CallAudioPreference = {
  microphoneDeviceId?: string;
  noiseCancellationEnabled?: boolean;
};

const callAudioStorageKey = (identityId: string): string =>
  scopeClientStorageKey(`pigeon:callAudio:${identityId}`);

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

export function loadCallNoiseCancellationEnabled(identityId: string): boolean {
  const preference = loadCallAudioPreference(identityId);

  return preference.noiseCancellationEnabled ?? true;
}

export function loadCallMicrophoneDeviceId(
  identityId: string,
): string | undefined {
  return loadCallAudioPreference(identityId).microphoneDeviceId;
}

/** An undefined device chooses the browser's default microphone again. */
export function saveCallMicrophoneDeviceId(
  identityId: string,
  deviceId: string | undefined,
): void {
  saveCallAudioPreference(identityId, { microphoneDeviceId: deviceId });
}

export function saveCallNoiseCancellationEnabled(
  identityId: string,
  enabled: boolean,
): void {
  saveCallAudioPreference(identityId, {
    noiseCancellationEnabled: enabled,
  });
}
