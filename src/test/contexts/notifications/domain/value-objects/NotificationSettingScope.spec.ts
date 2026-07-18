import { NotificationDecision } from '../../../../../contexts/notifications/domain/value-objects/NotificationDecision';
import { NotificationEventType } from '../../../../../contexts/notifications/domain/value-objects/NotificationEventType';
import { NotificationSettingScope } from '../../../../../contexts/notifications/domain/value-objects/NotificationSettingScope';

describe(NotificationSettingScope.name, () => {
  it('compares scopes by their domain values', () => {
    const scope = NotificationSettingScope.fromPrimitives({
      channelId: 'general',
      communityId: 'community-1',
      type: 'community_channel',
    });

    expect(
      scope.belongsTo(
        NotificationSettingScope.fromPrimitives({
          channelId: 'general',
          communityId: 'community-1',
          type: 'community_channel',
        }),
      ),
    ).toBe(true);
    expect(
      scope.belongsTo(
        NotificationSettingScope.fromPrimitives({
          channelId: 'random',
          communityId: 'community-1',
          type: 'community_channel',
        }),
      ),
    ).toBe(false);
    expect(
      scope.belongsTo(
        NotificationSettingScope.fromPrimitives({
          communityId: 'community-1',
          type: 'community',
        }),
      ),
    ).toBe(false);
  });

  it('maps notification decisions to their event type', () => {
    expect(
      NotificationEventType.fromDecision(NotificationDecision.ACCEPTED).isEqual(
        NotificationEventType.ACCEPTED,
      ),
    ).toBe(true);
    expect(
      NotificationEventType.fromDecision(NotificationDecision.DECLINED).isEqual(
        NotificationEventType.DECLINED,
      ),
    ).toBe(true);
  });
});
