import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallParticipant } from '../../../../../contexts/calls/presentation/view-models/CallParticipant';

import { reconciledCallParticipants } from '../../../../../contexts/calls/presentation/hooks/reconciledCallParticipants';

function callResource(
  participant: CallResource['participants'][number],
): CallResource {
  return {
    createdAt: 1,
    creatorIdentityId: 'alice',
    id: 'call-1',
    networkId: 'network-1',
    participantIds: ['alice', participant.identityId],
    participants: [participant],
    scope: { conversationId: 'conversation-1', type: 'conversation' },
    status: 'active',
  };
}

describe(reconciledCallParticipants.name, () => {
  it('preserves browser media state while applying resource status', () => {
    const mediaStream = {} as MediaStream;
    const current: CallParticipant = {
      bitrateKbps: 320,
      codec: 'opus',
      connectionState: 'connected',
      iceState: 'connected',
      identityId: 'bob',
      jitterMs: 4,
      latencyMs: 42,
      mediaStream,
      muted: true,
      name: 'Old name',
      packetsLost: 1,
      speaking: true,
    };
    const incoming: CallParticipant = {
      identityId: 'bob',
      muted: false,
      name: 'Bob',
      picture: 'bob-avatar',
    };

    expect(
      reconciledCallParticipants(
        [current],
        [incoming],
        callResource({
          connected: false,
          identityId: 'bob',
          lastHeartbeatAt: 123,
          mediaConnections: [],
          status: 'joined',
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        bitrateKbps: 320,
        codec: 'opus',
        connected: false,
        connectionState: 'connected',
        iceState: 'connected',
        jitterMs: 4,
        lastHeartbeatAt: 123,
        latencyMs: 42,
        mediaConnections: [],
        mediaStream,
        muted: true,
        name: 'Bob',
        packetsLost: 1,
        picture: 'bob-avatar',
        speaking: true,
        status: 'joined',
      }),
    ]);
  });
});
