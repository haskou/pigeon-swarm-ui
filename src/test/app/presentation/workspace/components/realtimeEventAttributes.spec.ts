import type { RealtimeDomainEvent } from '../../../../../shared/infrastructure/realtime/RealtimeGateway';

import {
  callIdFromRealtimeEvent,
  callResourceRefreshIsRequired,
} from '../../../../../app/presentation/workspace/components/realtimeEventAttributes';

function event(input: {
  aggregateId: string;
  attributes: Record<string, unknown>;
  type: string;
}): RealtimeDomainEvent {
  return {
    aggregate_id: input.aggregateId,
    attributes: input.attributes,
    causation_id: 'causation-1',
    correlation_id: 'correlation-1',
    event_id: 'event-1',
    occurred_on: 1_770_000_000_000,
    type: input.type,
  };
}

describe(callIdFromRealtimeEvent.name, () => {
  it('reads the call id from lease attributes instead of the lease aggregate', () => {
    expect(
      callIdFromRealtimeEvent(
        event({
          aggregateId: 'node-owned-lease-1',
          attributes: { callId: 'call-1' },
          type: 'calls.v1.participant_lease.was_updated',
        }),
      ),
    ).toBe('call-1');
  });

  it('keeps using the aggregate id for call lifecycle events', () => {
    expect(
      callIdFromRealtimeEvent(
        event({
          aggregateId: 'call-2',
          attributes: { callId: 'ignored-fallback' },
          type: 'calls.v1.participant.was_joined',
        }),
      ),
    ).toBe('call-2');
  });
});

describe(callResourceRefreshIsRequired.name, () => {
  it('does not refetch a call for an unchanged local lease heartbeat', () => {
    expect(
      callResourceRefreshIsRequired(
        event({
          aggregateId: 'lease-1',
          attributes: {
            callId: 'call-1',
            connectionChanged: false,
            participantIdentityId: 'alice',
            participantsChanged: false,
          },
          type: 'calls.v1.participant_lease.was_updated',
        }),
      ),
    ).toBe(false);
  });

  it('refetches a call when the local lease disconnects', () => {
    expect(
      callResourceRefreshIsRequired(
        event({
          aggregateId: 'lease-1',
          attributes: {
            callId: 'call-1',
            connectionChanged: true,
            participantIdentityId: 'alice',
            status: 'disconnected',
          },
          type: 'calls.v1.participant_lease.was_updated',
        }),
      ),
    ).toBe(true);
  });

  it('does not refetch a call when only remote media diagnostics change', () => {
    expect(
      callResourceRefreshIsRequired(
        event({
          aggregateId: 'lease-1',
          attributes: {
            callId: 'call-1',
            connectionChanged: false,
            mediaConnectionsChanged: true,
            participantIdentityId: 'bob',
            participantsChanged: false,
          },
          type: 'calls.v1.participant_lease.was_updated',
        }),
      ),
    ).toBe(false);
  });

  it('refetches a call when a remote lease connection changes', () => {
    expect(
      callResourceRefreshIsRequired(
        event({
          aggregateId: 'lease-1',
          attributes: {
            callId: 'call-1',
            connectionChanged: true,
            participantIdentityId: 'bob',
          },
          type: 'calls.v1.participant_lease.was_updated',
        }),
      ),
    ).toBe(true);
  });

  it('refetches lifecycle events', () => {
    expect(
      callResourceRefreshIsRequired(
        event({
          aggregateId: 'call-1',
          attributes: {},
          type: 'calls.v1.participant.joined',
        }),
      ),
    ).toBe(true);
  });
});
