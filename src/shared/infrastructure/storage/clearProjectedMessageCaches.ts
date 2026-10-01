import { scopeClientStorageKey } from './ClientStorageScope';

const CACHE_DATABASES = [
  'pigeon-message-projection-cache',
  'pigeon-community-message-projection-cache',
];
const CACHE_STORE = 'projectedMessages';

async function clearDatabase(name: string): Promise<void> {
  const known = await indexedDB.databases();

  // Opening a missing database would create it without its store and break
  // the decrypt workers, which rely on their own upgrade path.
  if (!known.some((database) => database.name === name)) return;

  await new Promise<void>((resolve) => {
    const request = indexedDB.open(name);

    request.addEventListener('error', () => resolve());
    request.addEventListener('success', () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        database.close();
        resolve();

        return;
      }

      const transaction = database.transaction(CACHE_STORE, 'readwrite');

      transaction.objectStore(CACHE_STORE).clear();
      transaction.addEventListener('complete', () => {
        database.close();
        resolve();
      });
      transaction.addEventListener('error', () => {
        database.close();
        resolve();
      });
    });
  });
}

/** Removes decrypted message projections persisted for offline rendering. */
export async function clearProjectedMessageCaches(): Promise<void> {
  if (
    typeof indexedDB === 'undefined' ||
    typeof indexedDB.databases !== 'function'
  ) {
    return;
  }

  await Promise.all(
    CACHE_DATABASES.map((name) => clearDatabase(scopeClientStorageKey(name))),
  );
}
