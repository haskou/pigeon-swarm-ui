import type {
  ChatMessage,
  CommunityTextChannel,
  MessageResource,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/realtimeGateway';

export function resolveCommunityChannelId(
  channelId: null | string | undefined,
  channels: CommunityTextChannel[],
): null | string {
  if (channelId && channels.some((channel) => channel.id === channelId)) {
    return channelId;
  }

  return channels[0]?.id ?? null;
}

export function mergeChatMessages(
  currentMessages: ChatMessage[],
  incomingMessages: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();

  for (const message of currentMessages) byId.set(message.id, message);
  for (const message of incomingMessages) byId.set(message.id, message);

  return [...byId.values()].sort(
    (left, right) => left.timestamp - right.timestamp,
  );
}

export function realtimeStringAttribute(
  event: RealtimeDomainEvent,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = event.attributes[key];

    if (typeof value === 'string' && value.length > 0) return value;
  }

  return undefined;
}

export function realtimeMessageAttribute(
  event: RealtimeDomainEvent,
): MessageResource | null {
  const value = event.attributes.message;

  return value && typeof value === 'object' ? (value as MessageResource) : null;
}
