import type {
  CommunityTextChannel,
  CommunityVoiceChannel,
  NotificationScopeSetting,
} from '../../../../../shared/domain/pigeonResources.types';

import { CommunityChannelVisibility } from '../../../../../contexts/communities/presentation/view-models/CommunityChannelVisibility';
import { NotificationSettingsPolicy } from '../../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';

function setting(hidden: boolean): NotificationScopeSetting {
  return NotificationSettingsPolicy.normalize({
    hideMutedChannels: hidden,
    mobilePushEnabled: true,
    notificationLevel: hidden ? 'none' : 'all',
    scope: {
      channelId: 'channel',
      communityId: 'community',
      type: 'community_channel',
    },
    suppressEveryoneAndHere: false,
    suppressRoleMentions: false,
  });
}

const hiddenIds = new Set(['hidden', 'selected', 'active']);
const settingFor = ({ id }: { id: string }) => setting(hiddenIds.has(id));

describe('CommunityChannelVisibility', () => {
  describe('text', () => {
    const channel = (id: string, name: string) =>
      ({ id, name, threads: [] }) as unknown as CommunityTextChannel;

    it('hides muted channels but keeps the selected one', () => {
      const result = CommunityChannelVisibility.text({
        accessibleChannels: [
          channel('visible', 'general'),
          channel('hidden', 'secret'),
          channel('selected', 'current'),
        ],
        channelNotificationSetting: settingFor,
        channelsWithThreads: [],
        query: '',
        selectedChannelId: 'selected',
      });

      expect(result.map(({ id }) => id)).toEqual(['visible', 'selected']);
    });

    it('prefers the channel instance enriched with threads', () => {
      const enriched = {
        ...channel('visible', 'general'),
        threads: [{ rootMessageId: 'root' }],
      } as unknown as CommunityTextChannel;

      const result = CommunityChannelVisibility.text({
        accessibleChannels: [channel('visible', 'general')],
        channelNotificationSetting: settingFor,
        channelsWithThreads: [enriched],
        query: '',
        selectedChannelId: null,
      });

      expect(result[0]).toBe(enriched);
    });

    it('filters by trimmed case-insensitive name query', () => {
      const result = CommunityChannelVisibility.text({
        accessibleChannels: [channel('a', 'General'), channel('b', 'Random')],
        channelNotificationSetting: settingFor,
        channelsWithThreads: [],
        query: '  gEN ',
        selectedChannelId: null,
      });

      expect(result.map(({ id }) => id)).toEqual(['a']);
    });
  });

  describe('voice', () => {
    const channel = (id: string, name: string) =>
      ({ id, name }) as unknown as CommunityVoiceChannel;

    it('hides muted voice channels but keeps the active call channel', () => {
      const result = CommunityChannelVisibility.voice({
        accessibleChannels: [
          channel('visible', 'Lobby'),
          channel('hidden', 'Secret'),
          channel('active', 'Standup'),
        ],
        activeVoiceChannelId: 'active',
        channelNotificationSetting: settingFor,
        query: '',
      });

      expect(result.map(({ id }) => id)).toEqual(['visible', 'active']);
    });

    it('filters voice channels by query', () => {
      const result = CommunityChannelVisibility.voice({
        accessibleChannels: [channel('a', 'Lobby'), channel('b', 'Standup')],
        activeVoiceChannelId: null,
        channelNotificationSetting: settingFor,
        query: 'stand',
      });

      expect(result.map(({ id }) => id)).toEqual(['b']);
    });
  });
});
