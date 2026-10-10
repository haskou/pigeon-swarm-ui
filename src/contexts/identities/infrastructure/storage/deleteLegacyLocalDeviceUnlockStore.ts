import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';

const LEGACY_DEVICE_UNLOCK_DATABASE = 'pigeon-swarm-device-unlock';

/**
 * Deletes the IndexedDB database written by the removed local device-unlock
 * design. It held the identity master key and key pair beside a same-origin
 * AES key, so upgraded browsers must not keep it. Deleting a missing database
 * is a no-op, and browsers without IndexedDB skip the step. A blocked delete
 * completes once other tabs close the old database.
 */
export async function deleteLegacyLocalDeviceUnlockStore(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(
      scopeClientStorageKey(LEGACY_DEVICE_UNLOCK_DATABASE),
    );

    request.addEventListener('success', () => resolve());
    request.addEventListener('error', () => resolve());
    request.addEventListener('blocked', () => resolve());
  });
}
