import type { RealtimeDomainEvent } from '../../../../../shared/infrastructure/realtime/RealtimeGateway';

import { ConversationRealtimeEvent } from '../../../../../app/presentation/workspace/components/ConversationRealtimeEvent';

const event = (type: string): RealtimeDomainEvent => ({
  aggregate_id: 'conversation-id',
  attributes: {},
  causation_id: 'causation-id',
  correlation_id: 'correlation-id',
  event_id: 'event-id',
  occurred_on: 1,
  type,
});

describe(ConversationRealtimeEvent.name, () => {
  it.each([
    'conversations.v1.conversation.was_created',
    'conversations.v1.message.was_sent',
    'conversations.v1.call.event.was_recorded',
    'conversations.v1.messages.were_read',
  ])('recognizes %s as a conversation event', (type) => {
    expect(ConversationRealtimeEvent.handles(event(type))).toBe(true);
  });

  it('does not handle unrelated events', () => {
    expect(
      ConversationRealtimeEvent.handles(
        event('communities.v1.channel.message.was_sent'),
      ),
    ).toBe(false);
  });

  it.each([
    'conversations.v1.message.reaction.was_added',
    'conversations.v1.message.was_edited',
    'conversations.v1.message.was_pinned',
  ])('does not notify for %s', (type) => {
    expect(ConversationRealtimeEvent.shouldNotify(event(type))).toBe(false);
  });

  it('notifies for newly sent messages', () => {
    expect(
      ConversationRealtimeEvent.shouldNotify(
        event('conversations.v1.message.was_sent'),
      ),
    ).toBe(true);
  });
});
