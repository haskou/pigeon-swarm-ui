import {
  readJsonObjectFromLocalStorage,
  writeJsonToLocalStorage,
} from './jsonLocalStorage';

type StoredSeenIds = {
  ids?: unknown;
};

export class LocalSeenIds {
  public constructor(private readonly storagePrefix: string) {}

  public get(ownerId: string): string[] {
    const stored = readJsonObjectFromLocalStorage<StoredSeenIds>(
      this.storageKey(ownerId),
      {},
    );

    return this.normalizeIds(stored.ids);
  }

  public markSeen(ownerId: string, ids: string[]): string[] {
    const next = this.unique([...this.get(ownerId), ...ids]);

    writeJsonToLocalStorage(this.storageKey(ownerId), { ids: next });

    return next;
  }

  private normalizeIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return this.unique(
      value.filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0,
      ),
    );
  }

  private storageKey(ownerId: string): string {
    return `${this.storagePrefix}:${ownerId}`;
  }

  private unique(ids: string[]): string[] {
    return [...new Set(ids.filter((id) => id.trim().length > 0))];
  }
}
