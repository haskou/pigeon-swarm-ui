import type { IdentityAccessContexts } from '../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { ConversationDraftDeleter } from '../../../contexts/messages/application/delete-conversation-draft/ConversationDraftDeleter';
import type { ConversationDraftsSearcher } from '../../../contexts/messages/application/list-conversation-drafts/ConversationDraftsSearcher';
import type { ConversationDraftSaver } from '../../../contexts/messages/application/save-conversation-draft/ConversationDraftSaver';
import type { ConversationDraft as ConversationDraftProjection } from '../../../shared/domain/pigeonResources.types';
import type { Session } from '../../../shared/domain/pigeonResources.types';

import { DeleteConversationDraftMessage } from '../../../contexts/messages/application/delete-conversation-draft/messages/DeleteConversationDraftMessage';
import { ListConversationDraftsMessage } from '../../../contexts/messages/application/list-conversation-drafts/messages/ListConversationDraftsMessage';
import { SaveConversationDraftMessage } from '../../../contexts/messages/application/save-conversation-draft/messages/SaveConversationDraftMessage';

export class PigeonConversationDrafts {
  public constructor(
    private readonly identityContexts: IdentityAccessContexts,
    private readonly deleter: ConversationDraftDeleter,
    private readonly searcher: ConversationDraftsSearcher,
    private readonly saver: ConversationDraftSaver,
  ) {}

  private register(session: Session): void {
    this.identityContexts.register(session);
  }

  public async delete(session: Session, conversationId: string): Promise<void> {
    this.register(session);
    await this.deleter.delete(
      new DeleteConversationDraftMessage({
        actorIdentityId: session.identity.id,
        conversationId,
      }),
    );
  }

  public async list(session: Session): Promise<ConversationDraftProjection[]> {
    this.register(session);
    const drafts = await this.searcher.search(
      new ListConversationDraftsMessage(session.identity.id),
    );

    return drafts.map((draft) => ({
      ...draft.toPrimitives(),
      encryptedPayload: '',
    }));
  }

  public async save(
    session: Session,
    conversationId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<ConversationDraftProjection> {
    this.register(session);
    const draft = await this.saver.save(
      new SaveConversationDraftMessage({
        authorIdentityId: session.identity.id,
        content,
        conversationId,
        updatedAt,
      }),
    );

    return { ...draft.toPrimitives(), encryptedPayload: '' };
  }
}
