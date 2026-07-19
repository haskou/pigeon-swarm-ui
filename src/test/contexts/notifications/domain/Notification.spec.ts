import { Timestamp } from '@haskou/value-objects';

import { NotificationCannotBeAnsweredError } from '../../../../contexts/notifications/domain/errors/NotificationCannotBeAnsweredError';
import { Notification } from '../../../../contexts/notifications/domain/Notification';
import { NotificationDecision } from '../../../../contexts/notifications/domain/value-objects/NotificationDecision';

describe(Notification.name, () => {
  it('accepts a pending invitation and records the decision', () => {
    const notification = Notification.fromPrimitives({
      id: 'notification-1',
      recipientIdentityId: 'identity-1',
      state: 'pending',
      type: 'conversation_invitation',
    });

    notification.decide(NotificationDecision.ACCEPTED, new Timestamp(42));

    expect(notification.toPrimitives().state).toBe('accepted');
    expect(notification.pullDomainEvents()).toEqual([
      {
        aggregateId: 'notification-1',
        occurredAt: 42,
        type: 'NotificationAccepted',
      },
    ]);
  });

  it('does not allow a missed call to be answered', () => {
    const notification = Notification.fromPrimitives({
      id: 'notification-1',
      recipientIdentityId: 'identity-1',
      state: 'pending',
      type: 'missed_call',
    });

    expect(() =>
      notification.decide(NotificationDecision.ACCEPTED, new Timestamp(42)),
    ).toThrow(NotificationCannotBeAnsweredError);
  });

  it('does not decide an invitation twice', () => {
    const notification = Notification.fromPrimitives({
      id: 'notification-1',
      recipientIdentityId: 'identity-1',
      state: 'declined',
      type: 'community_invitation',
    });

    expect(() =>
      notification.decide(NotificationDecision.ACCEPTED, new Timestamp(42)),
    ).toThrow(NotificationCannotBeAnsweredError);
  });
});
