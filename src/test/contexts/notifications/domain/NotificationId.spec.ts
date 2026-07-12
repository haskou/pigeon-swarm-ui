import { DomainError } from '@haskou/value-objects';

import { NotificationId } from '../../../../contexts/notifications/domain/NotificationId';

describe(NotificationId.name, () => {
  it('normalizes notification ids before comparing them', () => {
    const notificationId = NotificationId.fromString(' notification-1 ');

    expect(
      notificationId.isEqual(NotificationId.fromString('notification-1')),
    ).toBe(true);
  });

  it('rejects blank notification ids', () => {
    expect(() => NotificationId.fromString('   ')).toThrow(DomainError);
  });
});
