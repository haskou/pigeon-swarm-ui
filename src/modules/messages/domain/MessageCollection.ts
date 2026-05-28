import type {
  ChatMessage,
  ConversationResource,
} from '../../../shared/domain/pigeonResources.types';

export class MessageCollection {
  public static lastDelivered(
    messages: readonly ChatMessage[],
  ): ChatMessage | undefined {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];

      if (!message.deliveryStatus) return message;
    }

    return undefined;
  }

  public static latestDeliveredTimestamp(
    messages: readonly ChatMessage[],
  ): number | undefined {
    return messages.reduce<number | undefined>((latestTimestamp, message) => {
      if (message.deliveryStatus) return latestTimestamp;

      return latestTimestamp === undefined
        ? message.timestamp
        : Math.max(latestTimestamp, message.timestamp);
    }, undefined);
  }

  public static isCaughtUpWithConversation(
    messages: readonly ChatMessage[],
    conversation: ConversationResource,
  ): boolean {
    if (conversation.latestMessageAt === undefined) return true;

    const latestDeliveredTimestamp = this.latestDeliveredTimestamp(messages);

    return (
      latestDeliveredTimestamp !== undefined &&
      latestDeliveredTimestamp >= conversation.latestMessageAt
    );
  }

  public static hasSameLatestDeliveredMessage(
    currentMessages: readonly ChatMessage[],
    latestMessages: readonly ChatMessage[],
  ): boolean {
    const currentLatestMessage = this.lastDelivered(currentMessages);
    const remoteLatestMessage = this.lastDelivered(latestMessages);

    if (!currentLatestMessage || !remoteLatestMessage) {
      return currentLatestMessage === remoteLatestMessage;
    }

    return this.isSameDeliveredMessage(
      currentLatestMessage,
      remoteLatestMessage,
    );
  }

  public static merge(
    currentMessages: ChatMessage[],
    incomingMessages: ChatMessage[],
  ): ChatMessage[] {
    const byId = new Map<string, ChatMessage>();
    const edits = [
      ...this.indexMessages(byId, currentMessages),
      ...this.indexMessages(byId, incomingMessages),
    ];
    const appliedEditIds = new Set<string>();

    for (const edit of edits.sort(
      (left, right) => left.timestamp - right.timestamp,
    )) {
      const targetMessageId = edit.raw.targetMessageId;

      if (!targetMessageId) continue;

      const target = byId.get(targetMessageId);

      if (!target) continue;

      byId.set(targetMessageId, this.applyEdit(target, edit));
      appliedEditIds.add(edit.id);
    }

    for (const edit of edits) {
      if (!appliedEditIds.has(edit.id)) byId.set(edit.id, edit);
    }

    return [...byId.values()].sort(
      (left, right) => left.timestamp - right.timestamp,
    );
  }

  private static applyEdit(
    target: ChatMessage,
    edit: ChatMessage,
  ): ChatMessage {
    return {
      ...target,
      content: edit.content,
      edited: true,
      editedAt: edit.timestamp,
      editMessageId: edit.id,
      encrypted: edit.encrypted,
      linkPreview: edit.linkPreview,
      mentions: edit.mentions,
      originalContent: target.originalContent ?? target.content,
    };
  }

  private static isEditMessage(message: ChatMessage): boolean {
    return message.raw.type === 'edited' && !!message.raw.targetMessageId;
  }

  private static isSameDeliveredMessage(
    left: ChatMessage,
    right: ChatMessage,
  ): boolean {
    return (
      left.id === right.id &&
      left.timestamp === right.timestamp &&
      left.content === right.content &&
      left.encrypted === right.encrypted &&
      left.edited === right.edited &&
      this.messageEditedAt(left) === this.messageEditedAt(right) &&
      this.messageAttachmentKey(left) === this.messageAttachmentKey(right) &&
      this.messageReactionKey(left) === this.messageReactionKey(right)
    );
  }

  private static messageEditedAt(message: ChatMessage): number | undefined {
    return message.editedAt ?? message.raw.editedAt;
  }

  private static messageAttachmentKey(message: ChatMessage): string {
    return message.attachments
      .map(
        (attachment) =>
          `${attachment.cid}:${attachment.filename}:${attachment.size}:${attachment.contentType}`,
      )
      .join('\u0000');
  }

  private static messageReactionKey(message: ChatMessage): string {
    return message.reactions
      .map(
        (reaction) =>
          `${reaction.authorIdentityId}:${reaction.emoji}:${reaction.createdAt}`,
      )
      .sort()
      .join('\u0000');
  }

  private static indexMessages(
    byId: Map<string, ChatMessage>,
    messages: ChatMessage[],
  ): ChatMessage[] {
    const edits: ChatMessage[] = [];

    for (const message of messages) {
      if (this.isEditMessage(message)) {
        edits.push(message);
      } else {
        byId.set(message.id, message);
      }
    }

    return edits;
  }
}
