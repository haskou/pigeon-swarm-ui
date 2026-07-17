import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { ConversationDraftSaved } from './events/ConversationDraftSaved';
import { MessageAuthorId } from './value-objects/MessageAuthorId';
import { MessageContent } from './value-objects/MessageContent';
import { MessageConversationId } from './value-objects/MessageConversationId';

export class ConversationDraft extends AggregateRoot {
  public static create(
    conversationId: MessageConversationId,
    authorId: MessageAuthorId,
    content: MessageContent,
    updatedAt: Timestamp,
  ): ConversationDraft {
    const draft = new ConversationDraft(
      conversationId,
      authorId,
      content,
      updatedAt,
    );

    draft.record(new ConversationDraftSaved(conversationId, updatedAt));

    return draft;
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<ConversationDraft>,
  ): ConversationDraft {
    return new ConversationDraft(
      MessageConversationId.fromString(primitives.conversationId),
      MessageAuthorId.fromString(primitives.authorId),
      MessageContent.fromString(primitives.content),
      new Timestamp(primitives.updatedAt),
    );
  }

  private constructor(
    private readonly conversationId: MessageConversationId,
    private readonly authorId: MessageAuthorId,
    private readonly content: MessageContent,
    private readonly updatedAt: Timestamp,
  ) {
    super();
  }

  public belongsToAuthor(authorId: MessageAuthorId): boolean {
    return this.authorId.isEqual(authorId);
  }

  public toPrimitives() {
    return {
      authorId: this.authorId.toString(),
      content: this.content.toString(),
      conversationId: this.conversationId.toString(),
      updatedAt: this.updatedAt.valueOf(),
    };
  }
}
