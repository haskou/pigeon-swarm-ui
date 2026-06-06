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

  public static rootMessageId(message: ChatMessage): string | undefined {
    if (message.threadRootMessageId) return message.threadRootMessageId;

    if (message.replyPreview) return undefined;

    return message.replyToMessageId ?? message.raw.replyToMessageId;
  }
}
