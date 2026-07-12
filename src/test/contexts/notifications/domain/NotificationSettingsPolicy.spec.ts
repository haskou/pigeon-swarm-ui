import type { NotificationScopeSetting } from '../../../../contexts/notifications/domain/notificationSettings.types';

import { NotificationSettingsPolicy } from '../../../../contexts/notifications/domain/NotificationSettingsPolicy';

function setting(
  overrides: Partial<NotificationScopeSetting>,
): NotificationScopeSetting {
  return NotificationSettingsPolicy.normalize({
    hideMutedChannels: false,
    mobilePushEnabled: true,
    notificationLevel: 'all',
    scope: { conversationId: 'conversation-1', type: 'conversation' },
    suppressEveryoneAndHere: false,
    suppressRoleMentions: false,
    ...overrides,
  });
}

describe('NotificationSettingsPolicy', () => {
  it('resolves channel settings before community settings', () => {
    const settings = NotificationSettingsPolicy.map([
      setting({
        notificationLevel: 'mentions',
        scope: { communityId: 'community-1', type: 'community' },
      }),
      setting({
        notificationLevel: 'none',
        scope: {
          channelId: 'channel-1',
          communityId: 'community-1',
          type: 'community_channel',
        },
      }),
    ]);

    const resolved = NotificationSettingsPolicy.resolve(settings, {
      channelId: 'channel-1',
      communityId: 'community-1',
      type: 'community_channel',
    });

    expect(resolved.notificationLevel).toBe('none');
  });

  it('inherits community settings for channels without overrides', () => {
    const settings = NotificationSettingsPolicy.map([
      setting({
        notificationLevel: 'mentions',
        scope: { communityId: 'community-1', type: 'community' },
      }),
    ]);

    const resolved = NotificationSettingsPolicy.resolve(settings, {
      channelId: 'channel-2',
      communityId: 'community-1',
      type: 'community_channel',
    });

    expect(resolved.notificationLevel).toBe('mentions');
  });

  it('hides muted channels only when hide muted channels is enabled', () => {
    const hidden = setting({
      hideMutedChannels: true,
      mutedUntil: null,
      scope: {
        channelId: 'channel-1',
        communityId: 'community-1',
        type: 'community_channel',
      },
    });
    const visible = setting({
      hideMutedChannels: false,
      mutedUntil: null,
      scope: {
        channelId: 'channel-2',
        communityId: 'community-1',
        type: 'community_channel',
      },
    });

    expect(NotificationSettingsPolicy.shouldHide(hidden)).toBe(true);
    expect(NotificationSettingsPolicy.shouldHide(visible)).toBe(false);
  });

  it('does not notify while muted temporarily or indefinitely', () => {
    const now = 1780000000000;

    expect(
      NotificationSettingsPolicy.shouldNotify(
        setting({ mutedUntil: now + 1 }),
        { currentIdentityId: 'me' },
        now,
      ),
    ).toBe(false);
    expect(
      NotificationSettingsPolicy.shouldNotify(
        setting({ mutedUntil: null }),
        { currentIdentityId: 'me' },
        now,
      ),
    ).toBe(false);
  });

  it('notifies in mentions mode for direct mentions', () => {
    expect(
      NotificationSettingsPolicy.shouldNotify(
        setting({ notificationLevel: 'mentions' }),
        {
          currentIdentityId: 'me',
          mentionedIdentityIds: ['me'],
        },
      ),
    ).toBe(true);
  });

  it('respects everyone and role mention suppression', () => {
    const suppressed = setting({
      notificationLevel: 'mentions',
      suppressEveryoneAndHere: true,
      suppressRoleMentions: true,
    });

    expect(
      NotificationSettingsPolicy.shouldNotify(suppressed, {
        currentIdentityId: 'me',
        currentRoleIds: ['role-1'],
        mentionedRoleIds: ['role-1'],
        mentionsEveryoneOrHere: true,
      }),
    ).toBe(false);
  });

  it('notifies in mentions mode for role members when roles are not suppressed', () => {
    expect(
      NotificationSettingsPolicy.shouldNotify(
        setting({ notificationLevel: 'mentions' }),
        {
          currentIdentityId: 'me',
          mentionedRoleMemberIds: ['me'],
        },
      ),
    ).toBe(true);
  });
});
