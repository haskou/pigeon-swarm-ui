import { Timestamp } from '@haskou/value-objects';

import { MessageAuthorId } from '../value-objects/MessageAuthorId';
import { MessageReactionEmoji } from '../value-objects/MessageReactionEmoji';

export class MessageReactionEntry {
  public constructor(
    private readonly authorId: MessageAuthorId,
    private readonly emoji: MessageReactionEmoji,
    private readonly createdAt: Timestamp,
  ) {}

  public belongsTo(
    authorId: MessageAuthorId,
    emoji: MessageReactionEmoji,
  ): boolean {
    return this.authorId.isEqual(authorId) && this.emoji.isEqual(emoji);
  }

  public getAuthorId(): MessageAuthorId {
    return this.authorId;
  }

  public getCreatedAt(): Timestamp {
    return this.createdAt;
  }

  public getEmoji(): MessageReactionEmoji {
    return this.emoji;
  }
}
