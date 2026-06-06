export type CachedRequestEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
  settled: boolean;
};
