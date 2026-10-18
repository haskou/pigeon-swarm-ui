import type { CallResource } from './CallResource';

/** One page of calls; `nextCursor` is null on the last page. */
export type CallsResource = {
  calls: CallResource[];
  nextCursor: string | null;
};
