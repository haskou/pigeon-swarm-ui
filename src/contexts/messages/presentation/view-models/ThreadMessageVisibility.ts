import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

export class ThreadMessageVisibility {
  public static forRoot(
    rootMessageId: string,
    messages: ChatMessage[],
  ): ChatMessage[] {
    return messages.filter((message) =>
      ThreadMessageVisibility.belongsToRoot(rootMessageId, message),
    );
  }

  public static belongsToRoot(
    rootMessageId: string,
    message: ChatMessage,
  ): boolean {
    const messageRootId = ThreadMessageVisibility.rootMessageId(message);

    return Boolean(messageRootId && messageRootId === rootMessageId);
  }

  public static isThreadMessage(message: ChatMessage): boolean {
    return Boolean(ThreadMessageVisibility.rootMessageId(message));
  }

  public static markAsThreadMessages(
    rootMessageId: string,
    messages: ChatMessage[],
  ): ChatMessage[] {
    return messages.map((message) => ({
      ...message,
      threadRootMessageId: message.threadRootMessageId ?? rootMessageId,
    }));
  }

  public static rootMessageId(message: ChatMessage): string | undefined {
    if (message.threadRootMessageId) return message.threadRootMessageId;

    return undefined;
  }
}
