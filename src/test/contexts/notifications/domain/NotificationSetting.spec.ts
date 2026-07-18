import { Timestamp } from '@haskou/value-objects';

import { NotificationSetting } from '../../../../contexts/notifications/domain/NotificationSetting';
import { NotificationMention } from '../../../../contexts/notifications/domain/value-objects/NotificationMention';
import { NotificationSettingScope } from '../../../../contexts/notifications/domain/value-objects/NotificationSettingScope';

describe(NotificationSetting.name, () => {
  const scope = NotificationSettingScope.fromPrimitives({
    conversationId: 'conversation-1',
    type: 'conversation',
  });

  it('suppresses delivery while temporarily muted', () => {
    const setting = NotificationSetting.fromPrimitives({
      ...NotificationSetting.defaults(scope).toPrimitives(),
      mutedUntil: 101,
    });

    expect(
      setting.shouldNotify(
        NotificationMention.fromPrimitives({ currentIdentityId: 'identity-1' }),
        new Timestamp(100),
      ),
    ).toBe(false);
  });

  it('delivers unsuppressed role mentions in mentions mode', () => {
    const setting = NotificationSetting.fromPrimitives({
      ...NotificationSetting.defaults(scope).toPrimitives(),
      notificationLevel: 'mentions',
    });

    expect(
      setting.shouldNotify(
        NotificationMention.fromPrimitives({
          currentIdentityId: 'identity-1',
          currentRoleIds: ['role-1'],
          mentionedRoleIds: ['role-1'],
        }),
        new Timestamp(100),
      ),
    ).toBe(true);
  });

  it('records setting resets', () => {
    const setting = NotificationSetting.defaults(scope);

    setting.reset(new Timestamp(42));

    expect(setting.pullDomainEvents()).toEqual([
      {
        aggregateId: 'conversation:conversation-1',
        occurredAt: 42,
        type: 'NotificationSettingReset',
      },
    ]);
  });
});
