import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

export class WorkspaceRealtimeEvent {
  private static readonly categories = {
    calls: 'call',
    communities: 'community',
    conversations: 'conversation',
    identities: 'identity',
    keychains: 'keychain',
    nodes: 'node',
    notifications: 'notification',
    polls: 'poll',
  } as const;

  public static category(
    event: RealtimeDomainEvent,
  ):
    | 'call'
    | 'community'
    | 'conversation'
    | 'identity'
    | 'ignored'
    | 'keychain'
    | 'node'
    | 'notification'
    | 'poll' {
    const prefix = event.type.split('.')[0];

    return this.categories[prefix as keyof typeof this.categories] ?? 'ignored';
  }

  public static updatesCommunityTimeline(event: RealtimeDomainEvent): boolean {
    return [
      'communities.v1.channel.message.was_deleted',
      'communities.v1.channel.message.was_pinned',
      'communities.v1.channel.message.was_unpinned',
      'communities.v1.channel.message.reaction.was_added',
      'communities.v1.channel.message.reaction.was_removed',
      'communities.v1.call.event.was_recorded',
    ].includes(event.type);
  }
}
