import { mock } from 'jest-mock-extended';

import type { PigeonMessagesApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessagesApi';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { IdentityAccessContexts } from '../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { ConversationDraft } from '../../../../../contexts/messages/domain/ConversationDraft';
import { MessageAuthorId } from '../../../../../contexts/messages/domain/value-objects/MessageAuthorId';
import { PigeonDraftRepository } from '../../../../../contexts/messages/infrastructure/http/PigeonDraftRepository';

describe(PigeonDraftRepository.name, () => {
  it('hydrates decrypted draft projections returned by the API', async () => {
    const messages = mock<PigeonMessagesApi>();
    const identities = new IdentityAccessContexts();
    const repository = new PigeonDraftRepository(messages, identities);
    const session = { identity: { id: 'author-a' } } as Session;

    identities.register(session);
    messages.listConversationDrafts.mockResolvedValue([
      {
        content: 'Draft',
        conversationId: 'conversation-a',
        encryptedPayload: 'ciphertext',
        updatedAt: 100,
      },
    ]);

    const drafts = await repository.search(
      MessageAuthorId.fromString('author-a'),
    );

    expect(drafts[0]).toBeInstanceOf(ConversationDraft);
    expect(drafts[0]?.toPrimitives()).toMatchObject({ content: 'Draft' });
  });
});
