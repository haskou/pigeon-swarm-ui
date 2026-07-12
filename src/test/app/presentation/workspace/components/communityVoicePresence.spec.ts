import type { CallResource } from '../../../../../contexts/calls/domain/callSession.types';
import type { Community } from '../../../../../shared/domain/pigeonResources.types';

import {
  communitiesWithCallVoicePresence,
  communityVoiceChannelTopologyKey,
} from '../../../../../app/presentation/workspace/components/communityVoicePresence';

describe('communityVoicePresence', () => {
  it('hydrates voice channel participants from active community calls', () => {
    const community = communityResource({
      voiceChannels: [
        { connectedIdentityIds: [], id: 'voice-1', name: 'General' },
        { connectedIdentityIds: ['stale'], id: 'voice-2', name: 'AFK' },
      ],
    });
    const calls = [
      communityCall({
        channelId: 'voice-1',
        participants: [
          {
            connected: true,
            identityId: 'denis',
            mediaConnections: [],
            status: 'joined',
          },
          {
            connected: true,
            identityId: 'hasko',
            mediaConnections: [],
            status: 'joined',
          },
          {
            connected: false,
            identityId: 'old-user',
            mediaConnections: [],
            status: 'left',
          },
        ],
      }),
    ];

    expect(communitiesWithCallVoicePresence([community], calls)).toEqual([
      communityResource({
        voiceChannels: [
          {
            connectedIdentityIds: ['denis', 'hasko'],
            id: 'voice-1',
            name: 'General',
          },
          { connectedIdentityIds: [], id: 'voice-2', name: 'AFK' },
        ],
      }),
    ]);
  });

  it('keeps the same reference when voice presence is already current', () => {
    const community = communityResource({
      voiceChannels: [
        { connectedIdentityIds: ['denis'], id: 'voice-1', name: 'General' },
      ],
    });
    const calls = [
      communityCall({
        channelId: 'voice-1',
        participants: [
          {
            connected: true,
            identityId: 'denis',
            mediaConnections: [],
            status: 'joined',
          },
        ],
      }),
    ];
    const communities = [community];

    expect(communitiesWithCallVoicePresence(communities, calls)).toBe(
      communities,
    );
  });

  it('builds a topology key without connected identities', () => {
    const community = communityResource({
      voiceChannels: [
        { connectedIdentityIds: ['one'], id: 'voice-2', name: 'Two' },
        { connectedIdentityIds: ['two'], id: 'voice-1', name: 'One' },
      ],
    });

    expect(communityVoiceChannelTopologyKey([community])).toBe(
      'community-1\u0000voice-1\u0000voice-2',
    );
  });
});

function communityResource(input: {
  voiceChannels: Array<{
    connectedIdentityIds?: string[];
    id: string;
    name: string;
  }>;
}): Community {
  return {
    autoJoinEnabled: false,
    createdAt: 1770000000000,
    description: 'Community',
    discoverable: true,
    id: 'community-1',
    memberIds: [],
    name: 'Community',
    networkId: 'network-1',
    ownerIdentityId: 'owner',
    textChannels: [],
    visibility: 'private',
    voiceChannels: input.voiceChannels.map((channel) => ({
      connectedIdentityIds: channel.connectedIdentityIds,
      createdAt: 1770000000000,
      id: channel.id,
      name: channel.name,
      type: 'voice',
    })),
  };
}

function communityCall(input: {
  channelId: string;
  participants: CallResource['participants'];
}): CallResource {
  return {
    createdAt: 1770000000000,
    creatorIdentityId: 'hasko',
    id: `call-${input.channelId}`,
    networkId: 'network-1',
    participantIds: input.participants.map(
      (participant) => participant.identityId,
    ),
    participants: input.participants,
    scope: {
      channelId: input.channelId,
      communityId: 'community-1',
      type: 'community_channel',
    },
    status: 'active',
  };
}
