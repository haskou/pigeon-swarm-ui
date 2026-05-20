import type { ChatMessage } from '../../../shared/domain/pigeonResources.types';

export class MessageCollection {
  public static merge(
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
}
