import { DomainError, Timestamp } from '@haskou/value-objects';

import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { MessageReactionEntry } from '../entities/MessageReactionEntry';
import { MessageAuthorId } from '../value-objects/MessageAuthorId';
import { MessageContent } from '../value-objects/MessageContent';
import { MessageDeliveryState } from '../value-objects/MessageDeliveryState';
import { MessageId } from '../value-objects/MessageId';
import { MessageKind } from '../value-objects/MessageKind';
import { MessageReactionEmoji } from '../value-objects/MessageReactionEmoji';
import { MessageVisibility } from '../value-objects/MessageVisibility';

export class Message extends AggregateRoot {
  public static reconstitute(
    id: MessageId,
    authorId: MessageAuthorId,
    content: MessageContent,
    delivery: MessageDeliveryState,
    kind: MessageKind,
    visibility: MessageVisibility,
    reactions: readonly MessageReactionEntry[],
  ): Message {
    return new Message(id, authorId, content, delivery, kind, visibility, [
      ...reactions,
    ]);
  }

  private constructor(
    private readonly id: MessageId,
    private readonly authorId: MessageAuthorId,
    private content: MessageContent,
    private readonly delivery: MessageDeliveryState,
    private readonly kind: MessageKind,
    private readonly visibility: MessageVisibility,
    private reactions: MessageReactionEntry[],
  ) {
    super();
  }

  public addReaction(
    authorId: MessageAuthorId,
    emoji: MessageReactionEmoji,
    createdAt: Timestamp,
  ): void {
    this.removeReaction(authorId, emoji);
    this.reactions = [
      ...this.reactions,
      new MessageReactionEntry(authorId, emoji, createdAt),
    ];

    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'MessageReactionAdded',
    });
  }

  public getAuthorId(): MessageAuthorId {
    return this.authorId;
  }

  public getContent(): MessageContent {
    return this.content;
  }

  public getId(): MessageId {
    return this.id;
  }

  public getReactions(): readonly MessageReactionEntry[] {
    return [...this.reactions];
  }

  public canBeEditedBy(authorId: MessageAuthorId): boolean {
    return (
      this.authorId.isEqual(authorId) &&
      this.delivery.isDelivered() &&
      this.visibility.isReadable() &&
      this.kind.isEditableText() &&
      !this.content.isBlank()
    );
  }

  public edit(authorId: MessageAuthorId, content: MessageContent): void {
    if (!this.canBeEditedBy(authorId)) {
      throw new DomainError('This message cannot be edited by this identity.');
    }

    if (this.content.isEqual(content)) return;

    this.content = content;
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'MessageEdited',
    });
  }

  public hasReaction(
    authorId: MessageAuthorId,
    emoji: MessageReactionEmoji,
  ): boolean {
    return this.reactions.some((reaction) =>
      reaction.belongsTo(authorId, emoji),
    );
  }

  public reactionCount(): number {
    return this.reactions.length;
  }

  public removeReaction(
    authorId: MessageAuthorId,
    emoji: MessageReactionEmoji,
  ): void {
    const nextReactions = this.reactions.filter(
      (reaction) => !reaction.belongsTo(authorId, emoji),
    );

    if (nextReactions.length === this.reactions.length) return;

    this.reactions = nextReactions;
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'MessageReactionRemoved',
    });
  }
}
