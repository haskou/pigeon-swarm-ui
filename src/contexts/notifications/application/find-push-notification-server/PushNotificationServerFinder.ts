import type { PushNotificationServer } from '../../domain/PushNotificationServer';
import type { PushNotificationServerRepository } from '../../domain/repositories/PushNotificationServerRepository';

export class PushNotificationServerFinder {
  public constructor(
    private readonly repository: PushNotificationServerRepository,
  ) {}

  public async find(): Promise<PushNotificationServer> {
    return await this.repository.find();
  }
}
