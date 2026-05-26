import { LocalSeenIds } from '../../../../shared/infrastructure/storage/LocalSeenIds';

const storage = new LocalSeenIds('pigeon-swarm:seen-notifications');

export class SeenNotifications {
  public get(identityId: string): string[] {
    return storage.get(identityId);
  }

  public markSeen(identityId: string, notificationIds: string[]): string[] {
    return storage.markSeen(identityId, notificationIds);
  }
}
