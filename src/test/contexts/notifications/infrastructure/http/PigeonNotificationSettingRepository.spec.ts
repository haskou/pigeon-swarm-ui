import { mock } from 'jest-mock-extended';

import type { PigeonNotificationsGateway } from '../../../../../contexts/notifications/infrastructure/http/PigeonNotificationsGateway';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { NotificationSetting } from '../../../../../contexts/notifications/domain/NotificationSetting';
import { NotificationRecipientId } from '../../../../../contexts/notifications/domain/value-objects/NotificationRecipientId';
import { NotificationSettingScope } from '../../../../../contexts/notifications/domain/value-objects/NotificationSettingScope';
import { NotificationAccessContexts } from '../../../../../contexts/notifications/infrastructure/http/NotificationAccessContexts';
import { NotificationSettingMapper } from '../../../../../contexts/notifications/infrastructure/http/NotificationSettingMapper';
import { PigeonNotificationSettingRepository } from '../../../../../contexts/notifications/infrastructure/http/PigeonNotificationSettingRepository';

describe(PigeonNotificationSettingRepository.name, () => {
  it('maps settings returned by the HTTP gateway', async () => {
    const gateway = mock<PigeonNotificationsGateway>();
    const contexts = new NotificationAccessContexts();
    contexts.register({
      identity: { id: 'identity-1' },
    } as unknown as Session);
    const scope = NotificationSettingScope.fromPrimitives({
      conversationId: 'conversation-1',
      type: 'conversation',
    });
    gateway.listNotificationSettings.mockResolvedValue([
      NotificationSetting.defaults(scope).toPrimitives(),
    ]);
    const repository = new PigeonNotificationSettingRepository(
      gateway,
      contexts,
      new NotificationSettingMapper(),
    );

    const settings = await repository.searchByRecipient(
      NotificationRecipientId.fromString('identity-1'),
    );

    expect(settings).toHaveLength(1);
    expect(settings[0]?.belongsTo(scope)).toBe(true);
  });
});
