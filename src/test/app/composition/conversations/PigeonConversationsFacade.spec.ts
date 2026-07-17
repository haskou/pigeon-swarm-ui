import { mockDeep } from 'jest-mock-extended';

import type { ConversationUseCases } from '../../../../app/composition/conversations/ConversationUseCases';

import { PigeonConversationsFacade } from '../../../../app/composition/conversations/PigeonConversationsFacade';
import { ConversationAccessContexts } from '../../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import { ConversationMapper } from '../../../../contexts/conversations/infrastructure/http/ConversationMapper';
import {
  conversationFixture,
  sessionFixture,
} from '../../../contexts/conversations/ConversationFixture';

describe(PigeonConversationsFacade.name, () => {
  it('registers the session and maps searched aggregates for presentation', async () => {
    const useCases = mockDeep<ConversationUseCases>();
    const conversation = conversationFixture();

    useCases.searcher.search.mockResolvedValue([conversation]);

    await expect(
      new PigeonConversationsFacade(
        new ConversationAccessContexts(),
        new ConversationMapper(),
        useCases,
      ).list(sessionFixture()),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'one-to-one:a', type: 'one-to-one' }),
    ]);
  });

  it('returns the keychain published while creating a conversation', async () => {
    const contexts = new ConversationAccessContexts();
    const useCases = mockDeep<ConversationUseCases>();

    useCases.creator.create.mockResolvedValue(conversationFixture());

    await expect(
      new PigeonConversationsFacade(
        contexts,
        new ConversationMapper(),
        useCases,
      ).create(sessionFixture(), 'identity-b', 'network-a'),
    ).resolves.toMatchObject({
      conversation: { id: 'one-to-one:a' },
      keychainExternalIdentifier: 'keychain-a',
    });
  });
});
