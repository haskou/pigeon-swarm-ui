import type { PushNotificationServer } from '../PushNotificationServer';

export interface PushNotificationServerRepository {
  find(): Promise<PushNotificationServer>;
}
