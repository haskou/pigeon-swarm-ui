import type { BaseNotificationResource } from './BaseNotificationResource';
import type { MissedCallPayload } from './MissedCallPayload';

export type MissedCallNotificationResource = BaseNotificationResource & {
  payload: MissedCallPayload;
  type: 'missed_call';
};
