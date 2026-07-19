import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

export class ConversationRealtimeEvent {
  public static projection(
    event: RealtimeDomainEvent,
    hasTimelineMessage: boolean,
  ): 'delete' | 'fetch' | 'pin' | 'reaction' | 'timeline' {
    if (this.isDeletion(event)) return 'delete';

    if (this.isReaction(event)) return 'reaction';

    if (this.isPin(event)) return 'pin';

    return hasTimelineMessage ? 'timeline' : 'fetch';
  }

  public static handles(event: RealtimeDomainEvent): boolean {
    return (
      this.isConversationLifecycle(event) ||
      this.isMessageTimeline(event) ||
      this.isReadReceipt(event)
    );
  }

  public static isCallEvent(event: RealtimeDomainEvent): boolean {
    return event.type === 'conversations.v1.call.event.was_recorded';
  }

  public static isConversationLifecycle(event: RealtimeDomainEvent): boolean {
    return event.type.startsWith('conversations.v1.conversation.');
  }

  public static isDeletion(event: RealtimeDomainEvent): boolean {
    return event.type.endsWith('.was_deleted');
  }

  public static isEdit(event: RealtimeDomainEvent): boolean {
    return event.type === 'conversations.v1.message.was_edited';
  }

  public static isMessageTimeline(event: RealtimeDomainEvent): boolean {
    return (
      event.type.startsWith('conversations.v1.message.') ||
      this.isCallEvent(event)
    );
  }

  public static isPin(event: RealtimeDomainEvent): boolean {
    return (
      event.type === 'conversations.v1.message.was_pinned' ||
      event.type === 'conversations.v1.message.was_unpinned'
    );
  }

  public static isReaction(event: RealtimeDomainEvent): boolean {
    return (
      event.type === 'conversations.v1.message.reaction.was_added' ||
      event.type === 'conversations.v1.message.reaction.was_removed'
    );
  }

  public static isReadReceipt(event: RealtimeDomainEvent): boolean {
    return event.type === 'conversations.v1.messages.were_read';
  }

  public static shouldNotify(event: RealtimeDomainEvent): boolean {
    return !this.isReaction(event) && !this.isEdit(event) && !this.isPin(event);
  }
}
