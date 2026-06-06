import type { CachedRequestOptions } from './CachedRequestOptions';

export type CachedGetRequest = <T>(
  key: string,
  loader: () => Promise<T>,
  options?: CachedRequestOptions,
) => Promise<T>;
