import { assert, Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { MessageBody } from './entities/MessageBody';
import { MessageLifecycle } from './entities/MessageLifecycle';
import { MessageReactions } from './entities/MessageReactions';
import { MessageNotEditableError } from './errors/MessageNotEditableError';
import { MessageCreated } from './events/MessageCreated';
import { MessageDeleted } from './events/MessageDeleted';
import { MessageEdited } from './events/MessageEdited';
import { MessagePinned } from './events/MessagePinned';
import { MessageReactionAdded } from './events/MessageReactionAdded';
import { MessageReactionRemoved } from './events/MessageReactionRemoved';
import { MessageUnpinned } from './events/MessageUnpinned';
import { MessageAuthorId } from './value-objects/MessageAuthorId';
import { MessageContent } from './value-objects/MessageContent';
import { MessageConversationId } from './value-objects/MessageConversationId';
import { MessageId } from './value-objects/MessageId';
import { MessageKind } from './value-objects/MessageKind';
import { MessageReactionEmoji } from './value-objects/MessageReactionEmoji';
import { MessageVisibility } from './value-objects/MessageVisibility';

export class Message extends AggregateRoot {
  public static create(
    id: MessageId,
    conversationId: MessageConversationId,
    authorId: MessageAuthorId,
    content: MessageContent,
    kind: MessageKind,
    visibility: MessageVisibility,
    occurredAt: Timestamp,
  ): Message {
    const message = new Message(
      id,
      conversationId,
      authorId,
      MessageBody.create(content, kind, visibility),
      MessageLifecycle.create(occurredAt),
      MessageReactions.empty(),
    );

    message.record(new MessageCreated(id, occurredAt));

    return message;
  }

  public static fromPrimitives(primitives: PrimitiveOf<Message>): Message {
    return new Message(
      MessageId.fromString(primitives.id),
      MessageConversationId.fromString(primitives.conversationId),
      MessageAuthorId.fromString(primitives.authorId),
      MessageBody.fromPrimitives({
        content: primitives.content,
        encrypted: primitives.encrypted,
        kind: primitives.kind,
      }),
      MessageLifecycle.fromPrimitives({
        createdAt: primitives.createdAt,
        deleted: primitives.deleted,
        deliveryState: primitives.deliveryState,
        pinned: primitives.pinned,
      }),
      MessageReactions.fromPrimitives({ entries: primitives.reactions }),
    );
  }

  private constructor(
    private readonly id: MessageId,
    private readonly conversationId: MessageConversationId,
    private readonly authorId: MessageAuthorId,
    private readonly body: MessageBody,
    private readonly lifecycle: MessageLifecycle,
    private readonly reactions: MessageReactions,
  ) {
    super();
  }

  public addReaction(
    authorId: MessageAuthorId,
    emoji: MessageReactionEmoji,
    occurredAt: Timestamp,
  ): void {
    if (!this.reactions.add(authorId, emoji, occurredAt)) return;

    this.record(new MessageReactionAdded(this.id, authorId, emoji, occurredAt));
  }

  public belongsTo(id: MessageId): boolean {
    return this.id.isEqual(id);
  }

  public belongsToConversation(conversationId: MessageConversationId): boolean {
    return this.conversationId.isEqual(conversationId);
  }

  public canBeEditedBy(authorId: MessageAuthorId): boolean {
    return (
      this.authorId.isEqual(authorId) &&
      this.lifecycle.canBeEdited() &&
      this.body.canBeEdited()
    );
  }

  public delete(authorId: MessageAuthorId, occurredAt: Timestamp): void {
    assert(this.authorId.isEqual(authorId), new MessageNotEditableError());

    if (!this.lifecycle.delete()) return;

    this.record(new MessageDeleted(this.id, occurredAt));
  }

  public deliver(): void {
    this.lifecycle.deliver();
  }

  public edit(
    authorId: MessageAuthorId,
    content: MessageContent,
    occurredAt: Timestamp,
  ): void {
    assert(this.canBeEditedBy(authorId), new MessageNotEditableError());

    if (!this.body.edit(content)) return;

    this.record(new MessageEdited(this.id, occurredAt));
  }

  public hasReaction(
    authorId: MessageAuthorId,
    emoji: MessageReactionEmoji,
  ): boolean {
    return this.reactions.has(authorId, emoji);
  }

  public pin(occurredAt: Timestamp): void {
    if (!this.lifecycle.pin()) return;

    this.record(new MessagePinned(this.id, occurredAt));
  }

  public reactionCount(): number {
    return this.reactions.count();
  }

  public removeReaction(
    authorId: MessageAuthorId,
    emoji: MessageReactionEmoji,
    occurredAt: Timestamp,
  ): void {
    if (!this.reactions.remove(authorId, emoji)) return;

    this.record(
      new MessageReactionRemoved(this.id, authorId, emoji, occurredAt),
    );
  }

  public toPrimitives() {
    const body = this.body.toPrimitives();
    const lifecycle = this.lifecycle.toPrimitives();

    return {
      authorId: this.authorId.toString(),
      content: body.content,
      conversationId: this.conversationId.toString(),
      createdAt: lifecycle.createdAt,
      deleted: lifecycle.deleted,
      deliveryState: lifecycle.deliveryState,
      encrypted: body.encrypted,
      id: this.id.toString(),
      kind: body.kind,
      pinned: lifecycle.pinned,
      reactions: this.reactions.toPrimitives().entries,
    };
  }

  public unpin(occurredAt: Timestamp): void {
    if (!this.lifecycle.unpin()) return;
    this.record(new MessageUnpinned(this.id, occurredAt));
  }
}
