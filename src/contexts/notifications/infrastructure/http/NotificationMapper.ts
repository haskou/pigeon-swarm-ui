import type { PrimitiveOf } from '@haskou/value-objects';

import type { Notification } from '../../domain/Notification';
import type { NotificationResource } from './resources/NotificationResource';

import { Notification as NotificationAggregate } from '../../domain/Notification';
import { NotificationProjectionNotFoundError } from './errors/NotificationProjectionNotFoundError';

export class NotificationMapper {
  private readonly projections = new WeakMap<
    Notification,
    NotificationResource
  >();

  public fromResource(resource: NotificationResource): Notification {
    const notification = NotificationAggregate.fromPrimitives({
      id: resource.id,
      recipientIdentityId: resource.recipientIdentityId,
      state: resource.state,
      type: resource.type,
    });

    this.projections.set(notification, resource);

    return notification;
  }

  public toResource(notification: Notification): NotificationResource {
    const projection = this.projections.get(notification);
    const primitives: PrimitiveOf<Notification> = notification.toPrimitives();

    if (!projection) {
      throw new NotificationProjectionNotFoundError();
    }

    return {
      ...projection,
      state: primitives.state,
    };
  }
}
