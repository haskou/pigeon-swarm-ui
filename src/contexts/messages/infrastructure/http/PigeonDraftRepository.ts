import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { IdentityAccessContexts } from '../../../identities/infrastructure/http/IdentityAccessContexts';
import type { ConversationDraft } from '../../domain/ConversationDraft';
import type { ConversationDraftRepository } from '../../domain/repositories/ConversationDraftRepository';
import type { MessageConversationId } from '../../domain/value-objects/MessageConversationId';
import type { PigeonMessagesApi } from './PigeonMessagesApi';

import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { ConversationDraft as DomainConversationDraft } from '../../domain/ConversationDraft';
import { MessageAuthorId } from '../../domain/value-objects/MessageAuthorId';

export class PigeonDraftRepository implements ConversationDraftRepository {
  public constructor(
    private readonly messages: PigeonMessagesApi,
    private readonly identities: IdentityAccessContexts,
  ) {}

  private session(authorId: MessageAuthorId): Session {
    return this.identities.find(IdentityId.fromString(authorId.toString()))
      .session;
  }

  public async create(draft: ConversationDraft): Promise<ConversationDraft> {
    const primitives = draft.toPrimitives();
    const saved = await this.messages.saveConversationDraft(
      this.session(MessageAuthorId.fromString(primitives.authorId)),
      primitives.conversationId,
      primitives.content,
      primitives.updatedAt,
    );

    draft.pullDomainEvents();

    return DomainConversationDraft.fromPrimitives({
      authorId: primitives.authorId,
      content: saved.content,
      conversationId: saved.conversationId,
      updatedAt: saved.updatedAt,
    });
  }

  public async delete(
    conversationId: MessageConversationId,
    actorIdentityId: MessageAuthorId,
  ): Promise<void> {
    await this.messages.deleteConversationDraft(
      this.session(actorIdentityId),
      conversationId.toString(),
    );
  }

  public async search(
    actorIdentityId: MessageAuthorId,
  ): Promise<ConversationDraft[]> {
    const drafts = await this.messages.listConversationDrafts(
      this.session(actorIdentityId),
    );

    return drafts.map((draft) =>
      DomainConversationDraft.fromPrimitives({
        authorId: actorIdentityId.toString(),
        content: draft.content,
        conversationId: draft.conversationId,
        updatedAt: draft.updatedAt,
      }),
    );
  }
}
