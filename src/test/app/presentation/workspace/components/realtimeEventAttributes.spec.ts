import type { RealtimeDomainEvent } from '../../../../../shared/infrastructure/realtime/RealtimeGateway';

import { callIdFromRealtimeEvent } from '../../../../../app/presentation/workspace/components/realtimeEventAttributes';

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
