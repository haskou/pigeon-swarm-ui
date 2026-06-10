export type ConversationRealtimeTimelineMessageKind = 'call-event' | 'message';

export function conversationRealtimeTimelineMessageKind(
  eventType: string,
): ConversationRealtimeTimelineMessageKind {
  return eventType === 'conversations.v1.call.event.was_recorded'
    ? 'call-event'
    : 'message';
}
