import type { CallResource } from '../../../../../contexts/calls/domain/callSession.types';
import type { RealtimeDomainEvent } from '../../../../../shared/infrastructure/realtime/RealtimeGateway';

import { callResourceWithParticipantLeaseUpdate } from '../../../../../app/presentation/workspace/components/callResourceWithParticipantLeaseUpdate';

describe(callResourceWithParticipantLeaseUpdate.name, () => {
  it('projects a disconnected lease onto an active call resource', () => {
    expect(
      callResourceWithParticipantLeaseUpdate(
        callResource(),
        leaseEvent({
          lastHeartbeatAt: 200,
          mediaConnections: [],
          status: 'disconnected',
        }),
      ),
    ).toMatchObject({
      participants: [
        {
          connected: false,
          identityId: 'bob',
          lastHeartbeatAt: 200,
          mediaConnections: [],
          status: 'joined',
        },
      ],
    });
  });

  it('projects a connected lease and its media path without a snapshot', () => {
    expect(
      callResourceWithParticipantLeaseUpdate(
        callResource(),
        leaseEvent({
          lastHeartbeatAt: 300,
          mediaConnections: [
            {
              remoteIdentityId: 'alice',
              state: 'connected',
              usesRelay: true,
            },
          ],
          status: 'connected',
        }),
      ),
    ).toMatchObject({
      participants: [
        {
          connected: true,
          lastHeartbeatAt: 300,
          mediaConnections: [
            {
              remoteIdentityId: 'alice',
              state: 'connected',
              usesRelay: true,
            },
          ],
        },
      ],
    });
  });

  it('requires a snapshot when an unknown participant is missing from topology', () => {
    expect(
      callResourceWithParticipantLeaseUpdate(
        callResource(),
        leaseEvent({ participantIdentityId: 'charlie' }),
      ),
    ).toBeUndefined();
  });

  it('projects a newly connected participant from the event topology', () => {
    expect(
      callResourceWithParticipantLeaseUpdate(
        callResource(),
        leaseEvent({
          lastHeartbeatAt: 400,
          participantIdentityId: 'charlie',
          participantIds: ['alice', 'bob', 'charlie'],
          participantsChanged: true,
          status: 'connected',
        }),
      ),
    ).toMatchObject({
      participantIds: ['alice', 'bob', 'charlie'],
      participants: [
        { identityId: 'bob' },
        {
          connected: true,
          identityId: 'charlie',
          lastHeartbeatAt: 400,
          mediaConnections: [],
          status: 'joined',
        },
      ],
    });
  });
});

function callResource(): CallResource {
  return {
    createdAt: 1,
    creatorIdentityId: 'alice',
    id: 'call-1',
    networkId: 'network-1',
    participantIds: ['alice', 'bob'],
    participants: [
      {
        connected: true,
        identityId: 'bob',
        lastHeartbeatAt: 100,
        mediaConnections: [{ remoteIdentityId: 'alice', state: 'connected' }],
        status: 'joined',
      },
    ],
    scope: { conversationId: 'conversation-1', type: 'conversation' },
    status: 'active',
  };
}

function leaseEvent(
  attributes: Partial<RealtimeDomainEvent['attributes']> = {},
): RealtimeDomainEvent {
  return {
    aggregate_id: 'lease-1',
    attributes: {
      callId: 'call-1',
      connectionChanged: true,
      lastHeartbeatAt: 200,
      mediaConnections: [],
      participantIdentityId: 'bob',
      participantIds: ['alice', 'bob'],
      participantsChanged: false,
      status: 'disconnected',
      ...attributes,
    },
    causation_id: 'causation-1',
    correlation_id: 'correlation-1',
    event_id: 'event-1',
    occurred_on: 200,
    type: 'calls.v1.participant_lease.was_updated',
  };
}
