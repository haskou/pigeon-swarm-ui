import { conversationRealtimeTimelineMessageKind } from '../../../../../app/presentation/workspace/components/conversationRealtimeTimelineMessage';

describe(conversationRealtimeTimelineMessageKind.name, () => {
  it('treats websocket conversation message resources as normal messages', () => {
    expect(
      conversationRealtimeTimelineMessageKind(
        'conversations.v1.message.was_sent',
      ),
    ).toBe('message');
  });

  it('treats recorded call resources as call events', () => {
    expect(
      conversationRealtimeTimelineMessageKind(
        'conversations.v1.call.event.was_recorded',
      ),
    ).toBe('call-event');
  });
});
