import type { MissedCallPayload } from '../../../domain/MissedCallPayload';
import type { BaseNotificationResource } from './BaseNotificationResource';

export type MissedCallNotificationResource = BaseNotificationResource & {
  payload: MissedCallPayload;
  type: 'missed_call';
};
