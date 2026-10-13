import { DeviceStorageEstimate } from './DeviceStorageEstimate';

type BrowserStorage = Pick<
  StorageManager,
  'estimate' | 'persist' | 'persisted'
>;

function browserStorage(): BrowserStorage | undefined {
  if (typeof navigator === 'undefined' || !('storage' in navigator)) {
    return undefined;
  }

  return navigator.storage;
}

/**
 * The browser's storage for this site. Without persistence the browser may
 * clear the site's data under storage pressure, which drops the device vault,
 * the stored direct history, and the outbox.
 */
export class DeviceStorage {
  public constructor(
    private readonly storage: BrowserStorage | undefined = browserStorage(),
  ) {}

  /** Usage, quota and persistence, or null when the browser gives none. */
  public async estimate(): Promise<DeviceStorageEstimate | null> {
    if (!this.storage) return null;

    try {
      const [{ quota, usage }, persisted] = await Promise.all([
        this.storage.estimate(),
        this.storage.persisted(),
      ]);

      if (quota === undefined || usage === undefined) return null;

      return new DeviceStorageEstimate(usage, quota, persisted);
    } catch {
      return null;
    }
  }

  /**
   * Asks the browser once to keep the site's data under storage pressure.
   * Never throws: a refusal or a missing API leaves storage best effort.
   */
  public async protect(): Promise<void> {
    try {
      if (!this.storage || (await this.storage.persisted())) return;

      await this.storage.persist();
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Persistent storage request failed.');
    }
  }
}
