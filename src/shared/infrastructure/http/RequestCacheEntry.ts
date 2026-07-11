export type RequestCacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
  settled: boolean;
};
