import type { NotificationResource, Session } from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export class ListNotifications {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(session: Session): Promise<NotificationResource[]> {
    return await this.gateway.listNotifications(session);
  }
}
