import type { ChatMessage } from '../../../shared/domain/pigeonResources.types';

export class MessageCollection {
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
