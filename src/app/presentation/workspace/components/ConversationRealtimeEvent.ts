import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

/**
 * The conversation events the node still emits: lifecycle changes of the
 * conversation metadata and recorded call events. Messages, reactions, pins
 * and read state live only in the sealed mailboxes.
 */
export class ConversationRealtimeEvent {
  public static isCallEvent(event: RealtimeDomainEvent): boolean {
    return event.type === 'conversations.v1.call.event.was_recorded';
  }

  public static isConversationLifecycle(event: RealtimeDomainEvent): boolean {
    return event.type.startsWith('conversations.v1.conversation.');
  }
}
