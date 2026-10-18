import type { NotificationResource } from './NotificationResource';

/** One page of notifications; `nextCursor` is null on the last page. */
export type NotificationsResource = {
  nextCursor: string | null;
  results: NotificationResource[];
};
