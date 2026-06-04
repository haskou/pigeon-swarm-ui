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
    if (message.threadRootMessageId) {
      return message.threadRootMessageId === rootMessageId;
    }

    return (
      (message.replyToMessageId ?? message.raw.replyToMessageId) ===
        rootMessageId && !message.replyPreview
    );
  }
}
