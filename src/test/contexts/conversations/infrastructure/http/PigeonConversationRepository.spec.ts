import { mock, type MockProxy } from 'jest-mock-extended';

import type { PigeonConversationsGateway } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationsGateway';

import { Conversation } from '../../../../../contexts/conversations/domain/Conversation';
import { ConversationNotFoundError } from '../../../../../contexts/conversations/domain/errors/ConversationNotFoundError';
import { ConversationId } from '../../../../../contexts/conversations/domain/value-objects/ConversationId';
import { ConversationParticipantId } from '../../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { ConversationAccessContexts } from '../../../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import { ConversationMapper } from '../../../../../contexts/conversations/infrastructure/http/ConversationMapper';
import { PigeonConversationRepository } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationRepository';
import { sessionFixture } from '../../ConversationFixture';

describe(PigeonConversationRepository.name, () => {
  let contexts: ConversationAccessContexts;
  let gateway: MockProxy<PigeonConversationsGateway>;
  let repository: PigeonConversationRepository;

  beforeEach(() => {
    contexts = new ConversationAccessContexts();
    gateway = mock<PigeonConversationsGateway>();
    repository = new PigeonConversationRepository(
      gateway,
      contexts,
      new ConversationMapper(),
    );
    contexts.register(sessionFixture());
  });

  it('creates a direct conversation and keeps the published keychain', async () => {
    gateway.createConversation.mockResolvedValue({
      conversation: {
        adminIds: [],
        id: 'one-to-one:a',
        networkId: 'network-a',
        participantIds: ['identity-a', 'identity-b'],
        type: 'one-to-one',
      },
      keychain: { conversations: {}, version: 2 },
      keychainExternalIdentifier: 'keychain-b',
    });

    await repository.create(
      Conversation.fromPrimitives({
        adminIds: [],
        creatorId: 'identity-a',
        id: 'one-to-one:a',
        latestMessageAt: 0,
        name: undefined,
        networkId: 'network-a',
        participantIds: ['identity-a', 'identity-b'],
        type: 'one-to-one',
      }),
      ConversationParticipantId.fromString('identity-a'),
    );

    expect(
      contexts.find(ConversationParticipantId.fromString('identity-a'))
        .keychainExternalIdentifier,
    ).toBe('keychain-b');
  });

  it('searches and maps conversations with their node activity', async () => {
    gateway.listConversations.mockResolvedValue([
      {
        adminIds: [],
        id: 'one-to-one:a',
        latestMessageAt: 100,
        networkId: 'network-a',
        participantIds: ['identity-a', 'identity-b'],
        type: 'one-to-one',
      },
    ]);

    const [conversation] = await repository.searchByIdentity(
      ConversationParticipantId.fromString('identity-a'),
    );

    expect(conversation?.toPrimitives().latestMessageAt).toBe(100);
  });

  it('leaves group activity unknown instead of reading node messages', async () => {
    gateway.listConversations.mockResolvedValue([
      {
        adminIds: ['identity-a'],
        id: 'group:a',
        name: 'Group',
        networkId: 'network-a',
        participantIds: ['identity-a', 'identity-b', 'identity-c'],
        type: 'group',
      },
    ]);

    const [conversation] = await repository.searchByIdentity(
      ConversationParticipantId.fromString('identity-a'),
    );

    expect(conversation?.toPrimitives().latestMessageAt).toBeUndefined();
  });

  it('fails explicitly when a conversation cannot be found', async () => {
    gateway.listConversations.mockResolvedValue([]);

    await expect(
      repository.find(
        ConversationId.fromString('one-to-one:missing'),
        ConversationParticipantId.fromString('identity-a'),
      ),
    ).rejects.toThrow(ConversationNotFoundError);
  });
});
