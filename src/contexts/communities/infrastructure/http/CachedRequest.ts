/* eslint-disable @typescript-eslint/no-use-before-define */

import type { CachedRequestOptions } from './CachedRequestOptions';

export type CachedRequest = <T>(
  key: string,
  loader: () => Promise<T>,
  options?: CachedRequestOptions,
) => Promise<T>;
