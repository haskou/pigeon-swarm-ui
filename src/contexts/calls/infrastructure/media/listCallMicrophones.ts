import type { CallMicrophoneDevice } from './CallMicrophoneDevice';

// Chromium aliases of other entries; the browser default is offered apart.
const aliasDeviceIds = ['default', 'communications'];

/**
 * Microphones a call can choose from. Browsers hide device ids until the
 * microphone is allowed, so the list can be empty before that.
 */
export async function listCallMicrophones(
  mediaDevices: Pick<MediaDevices, 'enumerateDevices'> | undefined,
): Promise<CallMicrophoneDevice[]> {
  if (!mediaDevices?.enumerateDevices) return [];

  const devices = await mediaDevices.enumerateDevices().catch(() => []);

  return devices
    .filter(
      (device) =>
        device.kind === 'audioinput' &&
        device.deviceId !== '' &&
        !aliasDeviceIds.includes(device.deviceId),
    )
    .map(({ deviceId, label }) => ({ deviceId, label }));
}
