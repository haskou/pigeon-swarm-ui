import { assert } from '@haskou/value-objects';

import type { Notification } from '../../domain/Notification';
import type { NotificationRepository } from '../../domain/repositories/NotificationRepository';
import type { NotificationId } from '../../domain/value-objects/NotificationId';
import type { NotificationRecipientId } from '../../domain/value-objects/NotificationRecipientId';

import { NotificationNotFoundError } from '../../domain/errors/NotificationNotFoundError';
import { NotificationAccessContexts } from './NotificationAccessContexts';
import { NotificationMapper } from './NotificationMapper';
import { PigeonNotificationsGateway } from './PigeonNotificationsGateway';

export class PigeonNotificationRepository implements NotificationRepository {
  public constructor(
    private readonly gateway: PigeonNotificationsGateway,
    private readonly contexts: NotificationAccessContexts,
    private readonly mapper: NotificationMapper,
  ) {}

  public async find(
    id: NotificationId,
    recipientIdentityId: NotificationRecipientId,
  ): Promise<Notification> {
    const notification = (
      await this.searchByRecipient(recipientIdentityId)
    ).find((candidate) => candidate.belongsTo(id));

    assert(notification, new NotificationNotFoundError());

    return notification;
  }

  public async save(
    notification: Notification,
    recipientIdentityId: NotificationRecipientId,
  ): Promise<Notification> {
    const primitives = notification.toPrimitives();
    const resource = await this.gateway.updateNotification(
      this.contexts.find(recipientIdentityId),
      primitives.id,
      primitives.state,
    );

    return this.mapper.fromResource(resource);
  }

  public async searchByRecipient(
    recipientIdentityId: NotificationRecipientId,
  ): Promise<Notification[]> {
    const resources = await this.gateway.listNotifications(
      this.contexts.find(recipientIdentityId),
    );

    return resources.map((resource) => this.mapper.fromResource(resource));
  }
}
