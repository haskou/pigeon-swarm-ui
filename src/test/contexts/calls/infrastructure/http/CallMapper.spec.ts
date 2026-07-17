import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';

import { CallMapper } from '../../../../../contexts/calls/infrastructure/http/CallMapper';

const resource: CallResource = {
  createdAt: 100,
  creatorIdentityId: 'identity-a',
  id: 'call-a',
  networkId: 'network-a',
  participantIds: ['identity-a'],
  participants: [
    {
      connected: true,
      identityId: 'identity-a',
      joinedAt: 110,
      lastHeartbeatAt: 120,
      mediaConnections: [
        {
          localCandidateType: 'host',
          protocol: 'udp',
          remoteCandidateType: 'relay',
          remoteIdentityId: 'identity-b',
          state: 'connected',
          usesRelay: true,
        },
      ],
      status: 'joined',
    },
  ],
  scope: { conversationId: 'conversation-a', type: 'conversation' },
  status: 'active',
};

describe(CallMapper.name, () => {
  it('hydrates and serializes a complete call resource', () => {
    const mapper = new CallMapper();

    expect(mapper.toResource(mapper.fromResource(resource))).toEqual(resource);
  });

  it('hydrates community channel scopes', () => {
    const mapper = new CallMapper();
    const communityResource: CallResource = {
      ...resource,
      scope: {
        channelId: 'channel-a',
        communityId: 'community-a',
        type: 'community_channel',
      },
    };

    expect(
      mapper.toResource(mapper.fromResource(communityResource)).scope,
    ).toEqual(communityResource.scope);
  });
});
