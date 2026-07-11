import type {
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  Session,
} from '../../../shared/domain/pigeonResources.types';

import { PigeonNotificationsApi } from '../../../contexts/notifications/infrastructure/http/PigeonNotificationsApi';
import { PigeonNotificationsGateway } from './PigeonNotificationsGateway';

describe(PigeonNotificationsGateway.name, () => {
  let api: jest.Mocked<PigeonNotificationsApi>;
  let invalidateSettings: jest.Mock<void, [Session]>;
  let gateway: PigeonNotificationsGateway;
  let session: Session;

  beforeEach(() => {
    api = {
      list: jest.fn(),
      listSettings: jest.fn(),
      resetSetting: jest.fn(),
      saveSetting: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<PigeonNotificationsApi>;
    invalidateSettings = jest.fn();
    gateway = new PigeonNotificationsGateway(api, invalidateSettings);
    session = { identity: { id: 'identity-1' } } as unknown as Session;
  });

  it('invalidates cached settings after saving an override', async () => {
    const input = {
      notificationLevel: 'mentions',
      scope: { conversationId: 'conversation-1', type: 'conversation' },
    } as NotificationScopeSettingInput;
    const saved = { ...input, updatedAt: 1 } as NotificationScopeSetting;
    api.saveSetting.mockResolvedValue(saved);

    await expect(gateway.saveSetting(session, input)).resolves.toBe(saved);

    expect(invalidateSettings).toHaveBeenCalledWith(session);
  });

  it('invalidates cached settings after resetting an override', async () => {
    const scope = {
      communityId: 'community-1',
      type: 'community' as const,
    };

    await gateway.resetSetting(session, scope);

    expect(invalidateSettings).toHaveBeenCalledWith(session);
  });

  it('keeps cached settings when saving the override fails', async () => {
    const input = {
      notificationLevel: 'none',
      scope: { conversationId: 'conversation-1', type: 'conversation' },
    } as NotificationScopeSettingInput;
    api.saveSetting.mockRejectedValue(new Error('request failed'));

    await expect(gateway.saveSetting(session, input)).rejects.toThrow(
      'request failed',
    );

    expect(invalidateSettings).not.toHaveBeenCalled();
  });
});
