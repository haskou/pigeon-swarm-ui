const LOW_FREE_BYTES = 50 * 1024 * 1024;
const LOW_USED_RATIO = 0.9;

/** How much of the site's browser storage quota this device uses. */
export class DeviceStorageEstimate {
  public constructor(
    public readonly usage: number,
    public readonly quota: number,
    public readonly persisted: boolean,
  ) {}

  /** Less than 50 MiB free, or at least 90% of the quota used. */
  public get low(): boolean {
    return (
      this.quota - this.usage < LOW_FREE_BYTES ||
      this.usage >= this.quota * LOW_USED_RATIO
    );
  }
}
