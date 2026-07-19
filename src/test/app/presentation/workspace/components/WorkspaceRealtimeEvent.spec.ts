import type { RealtimeDomainEvent } from '../../../../../shared/infrastructure/realtime/RealtimeGateway';

import { WorkspaceRealtimeEvent } from '../../../../../app/presentation/workspace/components/WorkspaceRealtimeEvent';

const event = (type: string): RealtimeDomainEvent => ({
  aggregate_id: 'aggregate-id',
  attributes: {},
  causation_id: 'causation-id',
  correlation_id: 'correlation-id',
  event_id: 'event-id',
  occurred_on: 1,
  type,
});

describe(WorkspaceRealtimeEvent.name, () => {
  it.each([
    ['calls.v1.call.started', 'call'],
    ['communities.v1.channel.message.was_sent', 'community'],
    ['conversations.v1.message.was_sent', 'conversation'],
    ['identities.v1.identity.was_updated', 'identity'],
    ['keychains.v1.keychain.was_updated', 'keychain'],
    ['nodes.v1.node.network.was_removed', 'node'],
    ['notifications.v1.notification.was_created', 'notification'],
    ['polls.v1.poll.was_created', 'poll'],
  ])('routes %s to %s', (type, category) => {
    expect(WorkspaceRealtimeEvent.category(event(type))).toBe(category);
  });

  it('ignores unknown event families', () => {
    expect(WorkspaceRealtimeEvent.category(event('unknown.v1.event'))).toBe(
      'ignored',
    );
  });

  it('recognizes community timeline projections', () => {
    expect(
      WorkspaceRealtimeEvent.updatesCommunityTimeline(
        event('communities.v1.channel.message.was_pinned'),
      ),
    ).toBe(true);
  });
});
