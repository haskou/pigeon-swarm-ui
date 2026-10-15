const LEGACY_DEVICE_UNLOCK_DATABASE = 'pigeon-swarm-device-unlock';
const SCOPED_LEGACY_DEVICE_UNLOCK_PREFIX = `${LEGACY_DEVICE_UNLOCK_DATABASE}:`;

/**
 * Deletes the IndexedDB databases written by the removed local device-unlock
 * design. They held the identity master key and key pair beside a same-origin
 * AES key, so upgraded browsers must not keep them. Nothing is opened, read,
 * or migrated. The unscoped database is always deleted; the independent
 * client's per-node `pigeon-swarm-device-unlock:<scope>` databases are found
 * through `indexedDB.databases()` when the browser offers it. Deleting a
 * missing database is a no-op, browsers without IndexedDB skip the step, and a
 * blocked delete completes once other tabs close the old database.
 */
export async function deleteLegacyLocalDeviceUnlockStore(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  const names = new Set([LEGACY_DEVICE_UNLOCK_DATABASE]);

  if (typeof indexedDB.databases === 'function') {
    const databases = await indexedDB.databases().catch(() => []);

    for (const { name } of databases)
      if (name?.startsWith(SCOPED_LEGACY_DEVICE_UNLOCK_PREFIX)) names.add(name);
  }

  await Promise.all(
    [...names].map(
      (name) =>
        new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(name);

          request.addEventListener('success', () => resolve());
          request.addEventListener('error', () => resolve());
          request.addEventListener('blocked', () => resolve());
        }),
    ),
  );
}
