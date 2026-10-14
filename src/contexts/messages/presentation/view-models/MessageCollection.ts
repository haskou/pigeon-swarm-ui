import type { ChatMessage } from '../../domain/ChatMessage';

import { attachmentIdentity } from './attachmentIdentity';
import { MessageReactionUpdater } from './MessageReactionUpdater';

export class MessageCollection {
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
          `${attachmentIdentity(attachment)}:${attachment.filename}:${attachment.size}:${attachment.contentType}`,
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

  private static keepReactionClocks(
    previous: ChatMessage | undefined,
    next: ChatMessage,
  ): ChatMessage {
    const reactionClocks = MessageReactionUpdater.mergeClocks(
      previous?.reactionClocks,
      next.reactionClocks,
    );

    return reactionClocks.length === 0 ? next : { ...next, reactionClocks };
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
        byId.set(
          message.id,
          this.keepReactionClocks(byId.get(message.id), message),
        );
      }
    }

    return edits;
  }

  public static lastDelivered(
    messages: readonly ChatMessage[],
  ): ChatMessage | undefined {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];

      if (!message.deliveryStatus) return message;
    }

    return undefined;
  }

  public static lastDeliveredMessageTarget(
    messages: readonly ChatMessage[],
  ): ChatMessage | undefined {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];

      if (message.deliveryStatus) continue;

      if (message.kind && message.kind !== 'message') continue;

      if (message.raw.type && message.raw.type !== 'sent') continue;

      return message;
    }

    return undefined;
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

  public static hasUnknownMessages(
    currentMessages: readonly ChatMessage[],
    incomingMessages: readonly ChatMessage[],
  ): boolean {
    const currentIds = new Set(currentMessages.map((message) => message.id));

    return incomingMessages.some((message) => !currentIds.has(message.id));
  }
}
