import type { Permission } from './Permission';
import type { PwaNotificationPermission } from './PwaNotificationPermission';

export class PwaNotificationCapability {
  public canNotify(): boolean {
    return (
      'Notification' in globalThis &&
      'navigator' in globalThis &&
      'serviceWorker' in navigator
    );
  }

  public currentPermission(): PwaNotificationPermission {
    return this.canNotify() ? Notification.permission : 'unsupported';
  }

  public async requestPermission(): Promise<Permission> {
    if (!this.canNotify()) return 'denied';

    if (Notification.permission !== 'default') {
      return Notification.permission;
    }

    return await Notification.requestPermission();
  }
}
