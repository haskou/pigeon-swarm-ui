import { mock } from 'jest-mock-extended';

import type { ConversationDraftRepository } from '../../../../contexts/messages/domain/repositories/ConversationDraftRepository';

import { ConversationDraftDeleter } from '../../../../contexts/messages/application/delete-conversation-draft/ConversationDraftDeleter';
import { DeleteConversationDraftMessage } from '../../../../contexts/messages/application/delete-conversation-draft/messages/DeleteConversationDraftMessage';
import { ConversationDraftsSearcher } from '../../../../contexts/messages/application/list-conversation-drafts/ConversationDraftsSearcher';
import { ListConversationDraftsMessage } from '../../../../contexts/messages/application/list-conversation-drafts/messages/ListConversationDraftsMessage';
import { ConversationDraftSaver } from '../../../../contexts/messages/application/save-conversation-draft/ConversationDraftSaver';
import { SaveConversationDraftMessage } from '../../../../contexts/messages/application/save-conversation-draft/messages/SaveConversationDraftMessage';

describe('conversation draft use cases', () => {
  it('creates, searches and deletes drafts through their repository', async () => {
    const repository = mock<ConversationDraftRepository>();

    repository.create.mockImplementation((draft) => Promise.resolve(draft));
    repository.search.mockResolvedValue([]);
    const saved = await new ConversationDraftSaver(repository).save(
      new SaveConversationDraftMessage({
        authorIdentityId: 'author-a',
        content: 'Draft',
        conversationId: 'conversation-a',
        updatedAt: 100,
      }),
    );

    expect(saved.toPrimitives()).toMatchObject({ content: 'Draft' });
    await expect(
      new ConversationDraftsSearcher(repository).search(
        new ListConversationDraftsMessage('author-a'),
      ),
    ).resolves.toEqual([]);
    await new ConversationDraftDeleter(repository).delete(
      new DeleteConversationDraftMessage({
        actorIdentityId: 'author-a',
        conversationId: 'conversation-a',
      }),
    );
    expect(repository.delete).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    );
  });
});
