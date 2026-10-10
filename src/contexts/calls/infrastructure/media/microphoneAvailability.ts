export type MicrophoneAvailabilityEnvironment = {
  devices?: EventTarget;
  permission?: () => Promise<PermissionStatus>;
};

/**
 * Calls `onAvailable` when a media input device appears or the browser grants
 * microphone permission. It is only reported while permission is already
 * granted, so the caller never triggers a permission prompt without a user
 * gesture. Without the permissions API nothing is reported. Returns a cleanup
 * that removes every listener.
 */
export function watchMicrophoneAvailability(
  onAvailable: () => void,
  environment = browserMicrophoneEnvironment(),
): () => void {
  let disposed = false;
  let status: PermissionStatus | undefined;
  const reportIfGranted = () => {
    if (status?.state === 'granted') onAvailable();
  };

  environment.devices?.addEventListener('devicechange', reportIfGranted);
  void environment
    .permission?.()
    .then((permission) => {
      if (disposed) return;

      status = permission;
      permission.addEventListener('change', reportIfGranted);
    })
    .catch(() => undefined);

  return () => {
    disposed = true;
    environment.devices?.removeEventListener('devicechange', reportIfGranted);
    status?.removeEventListener('change', reportIfGranted);
  };
}

function browserMicrophoneEnvironment(): MicrophoneAvailabilityEnvironment {
  return {
    devices: navigator.mediaDevices,
    permission: navigator.permissions
      ? async () => navigator.permissions.query({ name: 'microphone' })
      : undefined,
  };
}
