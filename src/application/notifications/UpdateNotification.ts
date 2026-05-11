import type { NotificationResource, Session } from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export class UpdateNotification {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    session: Session,
    notificationId: string,
    state: 'accepted' | 'declined',
  ): Promise<NotificationResource> {
    return await this.gateway.updateNotification(
      session,
      notificationId,
      state,
    );
  }
}
