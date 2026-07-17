import type {
  Community,
  CommunityTextChannel,
  CommunityVoiceChannel,
} from '../../../../../shared/domain/pigeonResources.types';

import { CommunityChannelCollection } from '../../../../../contexts/communities/presentation/view-models/CommunityChannelCollection';

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

describe(CommunityChannelCollection.name, () => {
  it('uses current channel objects while preserving the preferred order', () => {
    const staleText = textChannel({ id: 'text-a', name: 'old name' });
    const currentText = textChannel({ id: 'text-a', name: 'new name' });
    const currentVoice = voiceChannel({ id: 'voice-a' });

    const channels = CommunityChannelCollection.fromCommunity(
      community({
        channels: [currentVoice, staleText],
        textChannels: [currentText],
        voiceChannels: [currentVoice],
      }),
    );

    expect(channels.all()).toEqual([currentVoice, currentText]);
    expect(channels.findById('text-a')).toBe(currentText);
  });

  it('drops stale preferred-order entries and appends new current channels', () => {
    const deletedChannel = textChannel({ id: 'deleted-channel' });
    const currentText = textChannel({ id: 'text-a' });
    const addedVoice = voiceChannel({ id: 'voice-a' });

    const channels = CommunityChannelCollection.fromCommunity(
      community({
        channels: [deletedChannel, currentText],
        textChannels: [currentText],
        voiceChannels: [addedVoice],
      }),
    );

    expect(channels.all()).toEqual([currentText, addedVoice]);
    expect(channels.has('deleted-channel')).toBe(false);
    expect(channels.has('voice-a')).toBe(true);
  });

  it('splits channels by kind without losing the combined order', () => {
    const text = textChannel({ id: 'text-a' });
    const voice = voiceChannel({ id: 'voice-a' });
    const channels = CommunityChannelCollection.fromChannels([voice, text]);

    expect(channels.split()).toEqual({
      channels: [voice, text],
      textChannels: [text],
      voiceChannels: [voice],
    });
  });
});
