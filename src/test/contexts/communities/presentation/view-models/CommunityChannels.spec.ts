import type { CommunityResource as Community } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { CommunityTextChannelResource as CommunityTextChannel } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityTextChannelResource';
import type { CommunityVoiceChannelResource as CommunityVoiceChannel } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityVoiceChannelResource';

import { CommunityChannels } from '../../../../../contexts/communities/presentation/view-models/CommunityChannels';

const textChannel = (
  overrides: Partial<CommunityTextChannel> = {},
): CommunityTextChannel => ({
  createdAt: 100,
  id: 'text-a',
  name: 'general',
  type: 'text',
  ...overrides,
});

const voiceChannel = (
  overrides: Partial<CommunityVoiceChannel> = {},
): CommunityVoiceChannel => ({
  connectedIdentityIds: [],
  createdAt: 100,
  id: 'voice-a',
  name: 'Voice',
  type: 'voice',
  ...overrides,
});

const community = (overrides: Partial<Community> = {}): Community => ({
  createdAt: 100,
  description: 'A community',
  id: 'community-a',
  memberIds: ['owner-a'],
  name: 'Builders',
  networkId: 'network-a',
  ownerIdentityId: 'owner-a',
  textChannels: [],
  visibility: 'private',
  ...overrides,
});

describe(CommunityChannels.name, () => {
  it('uses current channel collections while preserving the cached order', () => {
    const staleText = textChannel({
      id: 'text-a',
      name: 'old name',
    });
    const currentText = textChannel({
      id: 'text-a',
      name: 'new name',
    });
    const currentVoice = voiceChannel({ id: 'voice-a' });

    expect(
      CommunityChannels.all(
        community({
          channels: [currentVoice, staleText],
          textChannels: [currentText],
          voiceChannels: [currentVoice],
        }),
      ),
    ).toEqual([currentVoice, currentText]);
  });

  it('drops stale cached channels and appends current channels missing from the cached order', () => {
    const deletedChannel = textChannel({ id: 'deleted-channel' });
    const currentText = textChannel({ id: 'text-a' });
    const addedVoice = voiceChannel({ id: 'voice-a' });

    expect(
      CommunityChannels.all(
        community({
          channels: [deletedChannel, currentText],
          textChannels: [currentText],
          voiceChannels: [addedVoice],
        }),
      ),
    ).toEqual([currentText, addedVoice]);
  });
});
