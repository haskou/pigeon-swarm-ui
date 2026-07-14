import type {
  CallResource,
  CallResourceParticipant,
} from '../../../../../contexts/calls/domain/callSession.types';

import { reconciledCallResource } from '../../../../../app/presentation/workspace/components/reconciledCallResource';

function participant(
  overrides: Partial<CallResourceParticipant> = {},
): CallResourceParticipant {
  return {
    connected: true,
    identityId: 'bob',
    lastHeartbeatAt: 100,
    mediaConnections: [],
    status: 'joined',
    ...overrides,
  };
}

function callResource(overrides: Partial<CallResource> = {}): CallResource {
  return {
    createdAt: 1,
    creatorIdentityId: 'alice',
    id: 'call-1',
    networkId: 'network-1',
    participantIds: ['alice', 'bob'],
    participants: [participant()],
    scope: {
      channelId: 'voice-1',
      communityId: 'community-1',
      type: 'community_channel',
    },
    status: 'active',
    ...overrides,
  };
}

describe(reconciledCallResource.name, () => {
  it('preserves a participant learned from a newer realtime lease', () => {
    const realtimeParticipant = participant({
      identityId: 'charlie',
      lastHeartbeatAt: 300,
    });
    const previous = callResource({
      participantIds: ['alice', 'bob', 'charlie'],
      participants: [participant(), realtimeParticipant],
    });
    const staleSnapshot = callResource();

    expect(reconciledCallResource(previous, staleSnapshot)).toMatchObject({
      participantIds: ['alice', 'bob', 'charlie'],
      participants: [
        { identityId: 'bob' },
        {
          connected: true,
          identityId: 'charlie',
          lastHeartbeatAt: 300,
        },
      ],
    });
  });

  it('applies a newer participant disconnection from a snapshot', () => {
    const previous = callResource({
      participants: [participant({ lastHeartbeatAt: 200 })],
    });
    const disconnected = participant({
      connected: false,
      lastHeartbeatAt: 400,
      mediaConnections: [],
    });

    expect(
      reconciledCallResource(
        previous,
        callResource({ participants: [disconnected] }),
      ),
    ).toMatchObject({ participants: [disconnected] });
  });
});
