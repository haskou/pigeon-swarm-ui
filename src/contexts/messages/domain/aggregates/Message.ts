import { Timestamp } from '@haskou/value-objects';

import type {
  ChatMessage,
  MessageReaction,
} from '../../../../shared/domain/pigeonResources.types';

import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { MessageAuthorId } from '../value-objects/MessageAuthorId';
import { MessageContent } from '../value-objects/MessageContent';
import { MessageId } from '../value-objects/MessageId';
import { MessageReactionEmoji } from '../value-objects/MessageReactionEmoji';

export class Message extends AggregateRoot {
  public static fromChatMessage(resource: ChatMessage): Message {
    return new Message(
      MessageId.fromString(resource.id),
      MessageAuthorId.fromString(resource.authorIdentityId),
      MessageContent.fromString(resource.content),
      resource,
      resource.reactions ?? [],
    );
  }

  private constructor(
    private readonly id: MessageId,
    private readonly authorId: MessageAuthorId,
    private readonly content: MessageContent,
    private readonly resource: ChatMessage,
    private reactions: MessageReaction[],
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
      {
        authorIdentityId: authorId.toString(),
        createdAt: createdAt.valueOf(),
        emoji: emoji.toString(),
      },
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

  public hasReaction(
    authorId: MessageAuthorId,
    emoji: MessageReactionEmoji,
  ): boolean {
    return this.reactions.some(
      (reaction) =>
        MessageAuthorId.fromString(reaction.authorIdentityId).isEqual(
          authorId,
        ) && MessageReactionEmoji.fromString(reaction.emoji).isEqual(emoji),
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
      (reaction) =>
        MessageAuthorId.fromString(reaction.authorIdentityId).isNotEqual(
          authorId,
        ) || MessageReactionEmoji.fromString(reaction.emoji).isNotEqual(emoji),
    );

    if (nextReactions.length === this.reactions.length) return;

    this.reactions = nextReactions;
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'MessageReactionRemoved',
    });
  }

  public toChatMessage(): ChatMessage {
    return {
      ...this.resource,
      raw: { ...this.resource.raw, reactions: this.reactions },
      reactions: this.reactions,
    };
  }
}
