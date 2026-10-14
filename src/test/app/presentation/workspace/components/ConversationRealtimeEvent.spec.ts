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
  it('tells a recorded call apart from a lifecycle change', () => {
    expect(
      ConversationRealtimeEvent.isCallEvent(
        event('conversations.v1.call.event.was_recorded'),
      ),
    ).toBe(true);
    expect(
      ConversationRealtimeEvent.isCallEvent(
        event('conversations.v1.conversation.was_created'),
      ),
    ).toBe(false);
  });

  it.each([
    'conversations.v1.conversation.was_created',
    'conversations.v1.conversation.member.was_added',
  ])('recognizes %s as a conversation lifecycle change', (type) => {
    expect(ConversationRealtimeEvent.isConversationLifecycle(event(type))).toBe(
      true,
    );
  });

  it.each([
    'conversations.v1.call.event.was_recorded',
    'communities.v1.channel.message.was_sent',
  ])('does not treat %s as a lifecycle change', (type) => {
    expect(ConversationRealtimeEvent.isConversationLifecycle(event(type))).toBe(
      false,
    );
  });
});
