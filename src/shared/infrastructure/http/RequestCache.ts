import type { Session } from '../../domain/pigeonResources.types';
import type { RequestCacheEntry } from './RequestCacheEntry';
import type { RequestCacheOptions } from './RequestCacheOptions';

export class RequestCache {
  private readonly entries = new Map<string, RequestCacheEntry<unknown>>();

  public invalidate(key: string): void {
    this.entries.delete(key);
  }

  public invalidateForSession(path: string, session: Session): void {
    this.invalidate(this.keyForSession(path, session));
  }

  public keyForSession(path: string, session: Session): string {
    return `GET ${path} ${session.identity.id}`;
  }

  public async load<T>(
    key: string,
    loader: () => Promise<T>,
    options: RequestCacheOptions = {},
  ): Promise<T> {
    const now = Date.now();
    const cached = this.entries.get(key) as RequestCacheEntry<T> | undefined;

    if (cached && (!cached.settled || cached.expiresAt > now)) {
      return await cached.promise;
    }

    if (cached) this.entries.delete(key);

    const entry: RequestCacheEntry<T> = {
      expiresAt: Number.POSITIVE_INFINITY,
      promise: Promise.resolve(undefined as T),
      settled: false,
    };

    entry.promise = Promise.resolve()
      .then(loader)
      .then((result) => {
        entry.settled = true;
        entry.expiresAt = Date.now() + (options.ttlMs ?? 0);

        if (!options.ttlMs && this.entries.get(key) === entry) {
          this.entries.delete(key);
        }

        return result;
      })
      .catch((caught: unknown) => {
        if (this.entries.get(key) === entry) {
          this.entries.delete(key);
        }

        throw caught;
      });

    this.entries.set(key, entry);

    return await entry.promise;
  }
}
